// Although we can't use the ESM import statements in content scripts we can import types.
import type { CookieSettings, UserData, Login, LoginFields } from './common'

// "Quicksettings"
const platform = 'zih'
const cookieSettings: CookieSettings = {
    portalName: 'gitlabMn',
    domain: 'gitlab.mn.tu-dresden.de'
};

(async () => {
    const common = await import(chrome.runtime.getURL('contentScripts/login/common.js'))

    // For better syntax highlighting import the "Login" type from the common module and change it to "common.Login" when you're done.
    class GlMnLogin extends common.Login {
        constructor() {
            super(platform, cookieSettings)
        }

        async additionalFunctionsPreCheck(): Promise<void> { }

        async additionalFunctionsPostCheck(): Promise<void> { }

        async findCredentialsError(): Promise<boolean | HTMLElement | Element> {
            return document.querySelector('.flash-alert[data-testid="alert-danger"]')
        }

        async loginFieldsAvailable(): Promise<boolean | LoginFields> {
            return {
                usernameField: document.getElementById('username') as HTMLInputElement,
                passwordField: document.getElementById('password') as HTMLInputElement,
                submitButton: document.querySelector('input[type="submit"]') as HTMLInputElement
            }
        }

        async findLogoutButtons(): Promise<HTMLElement[]|NodeList> {
            return document.querySelectorAll('a.sign-out-link')
        }

        async login(userData: UserData, loginFields?: LoginFields): Promise<void> {
            if (!loginFields) return
            loginFields.usernameField.value = userData.user
            loginFields.passwordField.value = userData.pass;
            (document.getElementById('remember_me') as HTMLInputElement).checked = true;
            loginFields.submitButton.click()
        }
    }

    await (new GlMnLogin()).start()
})()