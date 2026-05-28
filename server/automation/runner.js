import { chromium } from 'playwright'
import { createServer } from 'http'

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
  <script>window.onload = function() { if(window.BN) BN.init({ version: '1.0' }) }</script>
  <script>
    (function(d, s, id) {
      var js, bjs = d.getElementsByTagName(s)[0];
      if(d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = 'https://console.botnoi.ai/customerchat/index.js';
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
  // First try to find iframes
  const frames = page.frames()
  for (const frame of frames) {
    if (frame === page.mainFrame()) continue
    try {
      for (const sel of ['input[type="text"]', 'textarea', 'input:not([type="hidden"])']) {
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
    'textarea[class*="chat"]'
  ]

  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el) return { frame: page, selector: sel, isFrame: false }
    } catch {}
  }

  return null
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

function startTempServer(html) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port })
    })
  })
}

export async function runCategoryTest(category, settings, onLog) {
  const allResults = []

  onLog(`🚀 เริ่มทดสอบ Category: "${category.name}"`)
  onLog(`📋 จำนวน scenarios: ${category.scenarios?.length || 0}`)
  onLog(`🔁 ทดสอบซ้ำ: ${category.repeat_count || 1} ครั้ง`)

  const { server, port } = await startTempServer(buildHtmlPage(settings))
  const testUrl = `http://127.0.0.1:${port}`

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (let run = 0; run < (category.repeat_count || 1); run++) {
      onLog(`\n--- Run #${run + 1}/${category.repeat_count || 1} ---`)

      for (const scenario of (category.scenarios || [])) {
        onLog(`\n📝 Scenario: "${scenario.name}"`)

        const context = await browser.newContext({ ignoreHTTPSErrors: true })
        const page = await context.newPage()

        const stepResults = []

        try {
          await page.goto(testUrl)
          onLog(`  ⏳ กำลังโหลด Webchat widget...`)

          // Wait for widget to load
          await page.waitForTimeout(3000)

          // Try to find and click the chat toggle button if not open
          const toggleSelectors = [
            '.bn-chat-button',
            '.bn-toggle',
            '[class*="chat-button"]',
            '[class*="toggle"]',
            'button[class*="bn"]'
          ]

          for (const sel of toggleSelectors) {
            try {
              const btn = await page.$(sel)
              if (btn) {
                await btn.click()
                await page.waitForTimeout(1000)
                break
              }
            } catch {}
          }

          await page.waitForTimeout(2000)

          // Find the chat input
          const inputInfo = await findChatInput(page)

          if (!inputInfo) {
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

          let previousResponse = await getLastBotMessage(inputInfo.frame)

          for (let stepIdx = 0; stepIdx < scenario.steps.length; stepIdx++) {
            const step = scenario.steps[stepIdx]
            const startTime = Date.now()

            onLog(`  💬 Step ${stepIdx + 1}: ส่ง "${step.message}"`)

            try {
              const inputEl = await inputInfo.frame.$(inputInfo.selector)
              await inputEl?.click()
              await inputEl?.fill(step.message)
              await inputInfo.frame.keyboard.press('Enter')
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
    server.close()
  }
}
