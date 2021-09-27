chrome.storage.local.get(['isEnabled', 'loggedOutJexam'], function (result) {
  if (result.isEnabled && !result.loggedOutJexam) {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('username') && document.getElementById('password')) {
        chrome.runtime.sendMessage({ cmd: 'get_user_data' }, function (result) {
          if (!(result.asdf === undefined || result.fdsa === undefined)) {
            chrome.runtime.sendMessage({ cmd: 'show_ok_badge', timeout: 2000 })
            chrome.runtime.sendMessage({ cmd: 'save_clicks', click_count: 1 })
            chrome.runtime.sendMessage({ cmd: 'perform_login' })
            document.getElementById('username').value = (result.asdf)
            document.getElementById('password').value = (result.fdsa)
            document.getElementsByTagName('input')[2].click()
          } else {
            chrome.runtime.sendMessage({ cmd: 'no_login_data' })
          }
        })
      }
      if (document.getElementsByClassName('logout nav-entry animate-fade-in')[0]) {
        document.getElementsByClassName('logout nav-entry animate-fade-in')[0].addEventListener('click', function () {
          chrome.runtime.sendMessage({ cmd: 'logged_out', portal: 'loggedOutJexam' })
        })
      }
    })
    console.log('Auto Login to jexam.')
  } else if (result.loggedOutJexam) {
    chrome.storage.local.set({ loggedOutJexam: false }, function () { })
  }
})
