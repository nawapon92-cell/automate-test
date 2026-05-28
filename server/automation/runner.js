import { chromium } from 'playwright'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP_DIR = join(__dirname, '../../.tmp')

function buildHtmlPage(settings) {
  return `<!DOCTYPE html>
<html lang="${settings.locale || 'th'}">
<head>
  <meta charset="UTF-8">
  <title>Webchat Test</title>
  <style>body { margin: 0; font-family: sans-serif; background: #f5f5f5; }</style>
</head>
<body>
  <div id="bn-root"></div>
  <script>
    (function(d, s, id) {
      var js, bjs = d.getElementsByTagName(s)[0];
      if(d.getElementById(id)) return;
      function initWhenReady(retry) {
        var hasWidget = d.querySelector('.bn-customerchat');
        if (window.BN && hasWidget) {
          window.BN.init({ version: '1.0' });
          return;
        }
        if (retry < 40) setTimeout(function() { initWhenReady(retry + 1); }, 250);
      }
      js = d.createElement(s); js.id = id;
      js.src = 'https://console.botnoi.ai/customerchat/index.js';
      js.onload = function() { initWhenReady(0); };
      bjs.parentNode.insertBefore(js, bjs);
    }(document, 'script', 'bn-jssdk'));
  </script>
  <div class="bn-customerchat"
    bot_id="${settings.bot_id}"
    ${settings.bot_logo ? `bot_logo="${settings.bot_logo}"` : ''}
    ${settings.bot_name ? `bot_name="${settings.bot_name}"` : ''}
    ${settings.theme_color ? `theme_color="${settings.theme_color}"` : ''}
    locale="${settings.locale || 'th'}"
    ${settings.greeting_message ? `greeting_message="${settings.greeting_message}"` : ''}
    default_open="true">
  </div>
</body>
</html>`
}

async function findChatInput(page) {
  const inputSelectors = [
    'input[type="text"]',
    'textarea',
    'input:not([type="hidden"])',
    '[contenteditable="true"]',
    '[role="textbox"]'
  ]

  // First try to find iframes
  const frames = page.frames()
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue
    try {
      for (const sel of inputSelectors) {
        const el = await frame.$(sel)
        if (el) return { frame, selector: sel, isFrame: true }
      }
    } catch {}
  }

  // Try direct selectors
  const selectors = [
    '.bn-input input',
    '.bn-chat-input input',
    '.bn-chat-input textarea',
    'input[class*="chat"]',
    'textarea[class*="chat"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    ...inputSelectors
  ]

  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el) return { frame: page, selector: sel, isFrame: false }
    } catch {}
  }

  return null
}

async function clickChatToggle(page) {
  const toggleSelectors = [
    '.bn-chat-button',
    '.bn-toggle',
    '[class*="chat-button"]',
    '[class*="chat-toggle"]',
    '[class*="toggle"]',
    'button[class*="bn"]',
    '[aria-label*="chat" i]',
    '[aria-label*="message" i]',
    '[role="button"][aria-label*="chat" i]'
  ]

  const contexts = [page, ...page.frames().filter(f => f !== page.mainFrame())]
  let clicked = false

  for (const ctx of contexts) {
    for (const sel of toggleSelectors) {
      try {
        const btn = await ctx.$(sel)
        if (btn) {
          await btn.click({ force: true })
          clicked = true
          await page.waitForTimeout(400)
        }
      } catch {}
    }
  }

  return clicked
}

async function clickBottomRightFallback(page) {
  try {
    const vp = page.viewportSize()
    if (!vp) return
    // Many chat widgets place the launcher button in the bottom-right corner.
    await page.mouse.click(Math.max(vp.width - 28, 1), Math.max(vp.height - 28, 1))
  } catch {}
}

async function collectChatDiagnostics(page) {
  const probes = [
    'iframe',
    'input[type="text"]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.bn-customerchat',
    '.bn-chat-button',
    '[class*="chat"]'
  ]

  const mainCounts = {}
  for (const sel of probes) {
    try {
      mainCounts[sel] = await page.locator(sel).count()
    } catch {
      mainCounts[sel] = -1
    }
  }

  const frames = page.frames().filter(f => f !== page.mainFrame())
  const frameSummaries = []
  for (const frame of frames.slice(0, 6)) {
    const counts = {}
    for (const sel of ['input[type="text"]', 'textarea', '[contenteditable="true"]', '[role="textbox"]', '[class*="chat"]']) {
      try {
        counts[sel] = await frame.locator(sel).count()
      } catch {
        counts[sel] = -1
      }
    }
    frameSummaries.push({ url: frame.url(), counts })
  }

  return { mainCounts, frameCount: frames.length, frameSummaries }
}

async function waitForChatInput(page, timeoutMs = 25000) {
  const start = Date.now()
  let tries = 0

  while (Date.now() - start < timeoutMs) {
    tries++
    const found = await findChatInput(page)
    if (found) return found

    await clickChatToggle(page)
    if (tries % 3 === 0) await clickBottomRightFallback(page)

    await page.waitForTimeout(1000)
  }

  return null
}

async function sendChatMessage(inputInfo, message) {
  const inputEl = await inputInfo.frame.$(inputInfo.selector)
  if (!inputEl) throw new Error('Chat input was not available when sending message')

  await inputEl.click()

  if (inputInfo.selector.includes('contenteditable')) {
    await inputEl.fill('')
    await inputInfo.frame.keyboard.type(message)
  } else {
    await inputEl.fill(message)
  }

  await inputInfo.frame.keyboard.press('Enter')
}

async function getLastBotMessage(frame) {
  const selectors = [
    '.bn-message:last-child .bn-message-text',
    '.bot-message:last-child',
    '.message-bot:last-child',
    '[class*="bot"][class*="message"]:last-child',
    '[class*="response"]:last-child',
    '.bn-chat-message:last-child',
    '[data-role="bot"]:last-child'
  ]

  for (const sel of selectors) {
    try {
      const el = await frame.$(sel)
      if (el) {
        const text = await el.textContent()
        if (text?.trim()) return text.trim()
      }
    } catch {}
  }

  // Fallback: get all text from the chat container
  const containerSelectors = ['.bn-chat-messages', '.bn-messages', '.chat-messages', '[class*="messages"]']
  for (const sel of containerSelectors) {
    try {
      const el = await frame.$(sel)
      if (el) {
        const text = await el.textContent()
        if (text?.trim()) {
          const lines = text.trim().split('\n').filter(l => l.trim())
          return lines[lines.length - 1] || ''
        }
      }
    } catch {}
  }

  return ''
}

async function waitForBotResponse(frame, page, previousResponseText, timeoutMs = 15000) {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    await page.waitForTimeout(500)
    const current = await getLastBotMessage(frame)
    if (current && current !== previousResponseText) {
      // Wait a bit more to ensure response is complete
      await page.waitForTimeout(1500)
      const final = await getLastBotMessage(frame)
      return final || current
    }
  }

  return ''
}

async function launchBrowser(onLog) {
  try {
    return await chromium.launch({ headless: true })
  } catch (err) {
    const msg = err?.message || String(err)
    const isMissingBrowser = msg.includes('Executable doesn\'t exist')
      || msg.includes('Please run the following command to download new browsers')

    if (isMissingBrowser) {
      throw new Error('Playwright Chromium ยังไม่ได้ติดตั้ง กรุณารันคำสั่ง "npx playwright install chromium" ในเทอร์มินัล แล้วลองใหม่อีกครั้ง')
    }

    throw err
  }
}

export async function runCategoryTest(category, settings, onLog) {
  const allResults = []
  const htmlContent = buildHtmlPage(settings)
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

  onLog(`🚀 เริ่มทดสอบ Category: "${category.name}"`)
  onLog(`📋 จำนวน scenarios: ${category.scenarios?.length || 0}`)
  onLog(`🔁 ทดสอบซ้ำ: ${category.repeat_count || 1} ครั้ง`)

  const browser = await launchBrowser(onLog)

  try {
    for (let run = 0; run < (category.repeat_count || 1); run++) {
      onLog(`\n--- Run #${run + 1}/${category.repeat_count || 1} ---`)

      for (const scenario of (category.scenarios || [])) {
        onLog(`\n📝 Scenario: "${scenario.name}"`)

        const context = await browser.newContext()
        const page = await context.newPage()

        const stepResults = []

        try {
          await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' })
          onLog(`  📄 โหลดหน้า widget จาก HTML ในตัวรันเนอร์`)
          onLog(`  ⏳ กำลังโหลด Webchat widget...`)

          // Wait for widget to load
          await page.waitForTimeout(3000)

          // Find the chat input (with retries because widget may load slowly)
          const inputInfo = await waitForChatInput(page)

          if (!inputInfo) {
            const debugInfo = await collectChatDiagnostics(page)
            onLog(`  🔎 Diagnostic: frameCount=${debugInfo.frameCount}, main=${JSON.stringify(debugInfo.mainCounts)}`)
            for (const fs of debugInfo.frameSummaries) {
              onLog(`  🔎 Frame: ${fs.url || '(blank)'} => ${JSON.stringify(fs.counts)}`)
            }
            onLog(`  ❌ ไม่พบ chat input สำหรับ scenario "${scenario.name}"`)
            allResults.push({
              scenario_id: scenario.id,
              scenario_name: scenario.name,
              run_index: run,
              status: 'fail',
              steps: [{
                step_index: 0,
                message_sent: '',
                bot_response: 'Could not find chat input',
                expected_keywords: [],
                matched_keywords: [],
                passed: false,
                duration_ms: 0
              }]
            })
            await context.close()
            continue
          }

          onLog(`  ✅ พบ chat input แล้ว`)
          if (scenario.steps?.length) {
            onLog(`  🔧 ใช้ข้อความแรกของ scenario เป็นการเปิดแชท`)
          }

          let previousResponse = await getLastBotMessage(inputInfo.frame)

          for (let stepIdx = 0; stepIdx < scenario.steps.length; stepIdx++) {
            const step = scenario.steps[stepIdx]
            const startTime = Date.now()

            onLog(`  💬 Step ${stepIdx + 1}: ส่ง "${step.message}"`)

            try {
              await sendChatMessage(inputInfo, step.message)
            } catch (e) {
              onLog(`  ⚠️  ส่งข้อความไม่สำเร็จ: ${e.message}`)
            }

            onLog(`  ⏳ รอ response จาก bot...`)
            const botResponse = await waitForBotResponse(inputInfo.frame, page, previousResponse)
            previousResponse = botResponse

            const duration = Date.now() - startTime

            const expectedKw = step.expected_keywords || []
            const matchedKw = expectedKw.filter(kw =>
              botResponse.toLowerCase().includes(kw.toLowerCase())
            )
            const passed = expectedKw.length === 0 || matchedKw.length === expectedKw.length

            onLog(`  🤖 Response: "${botResponse.substring(0, 100)}${botResponse.length > 100 ? '...' : ''}"`)
            if (expectedKw.length > 0) {
              onLog(`  🔑 Keywords: ${matchedKw.join(', ') || 'ไม่พบ'} / ต้องการ: ${expectedKw.join(', ')}`)
            }
            onLog(`  ${passed ? '✅' : '❌'} Step ${stepIdx + 1}: ${passed ? 'PASS' : 'FAIL'} (${duration}ms)`)

            stepResults.push({
              step_index: stepIdx,
              message_sent: step.message,
              bot_response: botResponse,
              expected_keywords: expectedKw,
              matched_keywords: matchedKw,
              passed,
              duration_ms: duration
            })
          }

          const scenPass = stepResults.every(s => s.passed)
          onLog(`  📊 Scenario "${scenario.name}": ${scenPass ? '✅ PASS' : '❌ FAIL'}`)

          allResults.push({
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            run_index: run,
            status: scenPass ? 'pass' : 'fail',
            steps: stepResults
          })

        } catch (err) {
          onLog(`  ❌ Error ใน scenario "${scenario.name}": ${err.message}`)
          allResults.push({
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            run_index: run,
            status: 'fail',
            steps: stepResults
          })
        } finally {
          await context.close()
        }
      }
    }

    const passCount = allResults.filter(r => r.status === 'pass').length
    onLog(`\n🏁 เสร็จสิ้น! ผ่าน ${passCount}/${allResults.length} scenarios`)

    return allResults

  } finally {
    await browser.close()
  }
}
