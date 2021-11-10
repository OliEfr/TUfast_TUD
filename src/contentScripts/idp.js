function loginIdp () {
  if (document.getElementById('username')) {
    chrome.runtime.sendMessage({ cmd: 'get_user_data' }, async (result) => {
      await result
      if (result.user && result.pass) {
        chrome.runtime.sendMessage({ cmd: 'save_clicks', click_count: 1 })
        document.getElementById('username').value = result.user
        document.getElementById('password').value = result.pass
        document.getElementsByName('_eventId_proceed')[0].click()
      } else {
        chrome.runtime.sendMessage({ cmd: 'no_login_data' })
      }
    })
  } else if (document.getElementsByName('_eventId_proceed')[0]) {
    document.getElementsByName('_eventId_proceed')[0].click()
    chrome.runtime.sendMessage({ cmd: 'perform_login' })
    chrome.runtime.sendMessage({ cmd: 'save_clicks', click_count: 1 })
  } else if (document.querySelectorAll('body > div:nth-child(2) > div:nth-child(1) > b')[0]) {
    if (document.querySelectorAll('body > div:nth-child(2) > div:nth-child(1) > b')[0].innerHTML === 'TUD - TU Dresden - Single Sign On - Veraltete Anfrage' ||
      document.querySelectorAll('body > div:nth-child(2) > div:nth-child(1) > b')[0].innerHTML === 'TUD - TU Dresden - Single Sign On - Stale Request') {
      window.location.replace('https://bildungsportal.sachsen.de/opal/login')
    }
  }

  console.log('Auto Login to TU Dresden Auth.')
}

chrome.storage.local.get(['isEnabled'], (result) => {
  if (!result.isEnabled) return

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loginIdp)
  } else {
    loginIdp()
  }
})
