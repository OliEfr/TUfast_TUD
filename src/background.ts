'use strict'
import * as credentials from "./modules/credentials"
import * as owaFetch from "./modules/owaFetch"

// eslint-disable-next-line no-unused-vars
const isFirefox = typeof browser !== 'undefined' && browser.runtime && browser.runtime.getBrowserInfo

// On installed/updated function
chrome.runtime.onInstalled.addListener(async (details) => {
    const reason = details.reason
    switch (reason) {
        case "install":
            console.log("TUfast installed")
            await chrome.storage.local.set({
                dashboardDisplay: 'favoriten',
                fwdEnabled: true,
                encryptionLevel: 3,
                availableRockets: ["RI_default"],
                selectedRocketIcon: '{"id": "RI_default", "link": "assets/icons/RocketIcons/default_128px.png"}',
                theme: "system",
                studiengang: "general",
            })
            await openSettingsPage("first_visit")
            break
        case "update":
            // Promisified until usage of Manifest V3
            const currentSettings = await new Promise<any>((resolve) => chrome.storage.local.get([
                'dashboardDisplay',
                'fwdEnabled',
                'encryptionLevel',
                'encryption_level', // legacy
                'availableRockets',
                'selectedRocketIcon',
                'theme',
                'studiengang',
                'hisqisPimpedTable',
                'savedClickCounter',
                'saved_click_counter', // legacy
                'Rocket', // legacy
                'foundEasteregg'
            ], resolve))

            const updateObj: any = {}

            // Setting the defaults if keys do not exist
            if (typeof currentSettings.dashboardDisplay === 'undefined') updateObj.dashboardDisplay = 'favoriten'
            if (typeof currentSettings.fwdEnabled === 'undefined') updateObj.fwdEnabled = true
            if (typeof currentSettings.hisqisPimpedTable === 'undefined') updateObj.hisqisPimpedTable = true
            if (typeof currentSettings.theme === 'undefined') updateObj.theme = 'system'
            if (typeof currentSettings.studiengang === 'undefined') updateObj.studiengang = 'general'
            if (typeof currentSettings.selectedRocketIcon === 'undefined') updateObj.selectedRocketIcon = '{"id": "RI_default", "link": "assets/icons/RocketIcons/default_128px.png"}'

            // Upgrading encryption
            // Currently "encryptionLevel" can't be lower than 3, but "encryption_level" can
            if (currentSettings.encryption_level !== 3) {
                switch (currentSettings.encryption_level) {
                    case 1: {
                        // This branch probably/hopefully will not be called anymore...
                        console.log('Upgrading encryption standard from level 1 to level 3...')
                        // Promisified until usage of Manifest V3
                        const userData = await new Promise<any>((resolve) => chrome.storage.local.get(['asdf', 'fdsa'], resolve))
                        await credentials.setUserData({ user: atob(userData.asdf), pass: atob(userData.fdsa) }, 'zih')
                        // Promisified until usage of Manifest V3
                        await new Promise<void>((resolve) => chrome.storage.local.remove(['asdf', 'fdsa'], resolve))
                        break
                    }
                    case 2: {
                        const { asdf: user, fdsa: pass } = await credentials.getUserDataLagacy()
                        await credentials.setUserData({ user, pass }, 'zih')
                        // Delete old user data
                        // Promisified until usage of Manifest V3
                        await new Promise<void>((resolve) => chrome.storage.local.remove(['Data'], resolve))
                        break
                    }
                }
                updateObj.encryptionLevel = 3
                // Promisified until usage of Manifest V3
                await new Promise<void>((resolve) => chrome.storage.local.remove(['encryption_level'], resolve))
            }

            // Upgrading saved_clicks_counter to savedClicksCounter
            const savedClicks = currentSettings.savedClickCounter || currentSettings.saved_click_counter
            if (typeof currentSettings.savedClickCounter === 'undefined' && typeof currentSettings.saved_click_counter !== 'undefined') {
                updateObj.savedClickCounter = savedClicks
                // Promisified until usage of Manifest V3
                await new Promise<void>((resolve) => chrome.storage.local.remove(['saved_click_counter'], resolve))
            }

            // Upgrading availableRockets
            const avRockets = currentSettings.availableRockets || ["RI_default"]
            if (savedClicks > 250 && !avRockets.includes('RI4')) avRockets.push('RI4')
            if (savedClicks > 2500 && !avRockets.includes('RI5')) avRockets.push('RI5')
            if (currentSettings.Rocket === 'colorful' && currentSettings.foundEasteregg === undefined) {
                updateObj.foundEasteregg = true
                updateObj.selectedRocketIcon = '{"id": "RI3", "link": "assets/icons/RocketIcons/3_120px.png"}'
                avRockets.push('RI3')
                // Promisified until usage of Manifest V3
                await new Promise<void>((resolve) => chrome.browserAction.setIcon({ path: 'assets/icons/RocketIcons/3_128px.png' }, resolve))
                // Promisified until usage of Manifest V3
                await new Promise<void>((resolve) => chrome.storage.local.remove(['Rocket'], resolve))
            }
            updateObj.availableRockets = avRockets

            // Write back to storage
            // Promisified until usage of Manifest V3
            await new Promise<void>((resolve) => chrome.storage.local.set(updateObj, resolve))
            break
    }
})

// register hotkeys
chrome.commands.onCommand.addListener(async (command) => {
    console.log('Detected command: ' + command)
    switch (command) {
        case 'open_opal_hotkey':
            chrome.tabs.update({ url: 'https://bildungsportal.sachsen.de/opal/home/' })
            await saveClicks(2)
            break
        case 'open_owa_hotkey':
            chrome.tabs.update({ url: 'https://msx.tu-dresden.de/owa/' })
            await saveClicks(2)
            break
        case 'open_jexam_hotkey':
            chrome.tabs.update({ url: 'https://jexam.inf.tu-dresden.de/' })
            await saveClicks(2)
            break
    }
})

// Set icon on startup
chrome.storage.local.get(['selectedRocketIcon'], (resp) => {
    try {
        const r = JSON.parse(resp.selectedRocketIcon)
        chrome.browserAction.setIcon({
            path: r.link
        })
    } catch (e) {
        console.log(`Cannot parse rocket icon: ${resp}`)
        chrome.browserAction.setIcon({
            path: "assets/icons/RocketIcons/default_128px.png",
        })
    }
})

// start fetchOWA if activated and user data exists
chrome.storage.local.get(['enabledOWAFetch', 'numberOfUnreadMails', 'additionalNotificationOnNewMail'], async (result: any) => {
    if (await credentials.userDataExists('zih') && result.enabledOWAFetch) {
        await owaFetch.enableOWAFetch()
    }
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.permissions.contains({ permissions: ['notifications'] }, (granted: boolean) => {
        if (granted && result.additionalNotificationOnNewMail) {
            // register listener for owaFetch notifications
            chrome.notifications.onClicked.addListener(async (id) => {
                if (id === 'tuFastNewEmailNotification') {
                    // Promisified until usage of Manifest V3
                    await new Promise<chrome.tabs.Tab>((resolve) => chrome.tabs.create({ url: 'https://msx.tu-dresden.de/owa/' }, resolve))
                }
            })
        }
        resolve();
    }))
})

// Register header listener
chrome.storage.local.get(['pdfInNewTab'], (result) => {
    if (result.pdfInNewTab) {
        enableHeaderListener(true)
    }
})

//  reset banner for gOPAL
const d = new Date()
const month = d.getMonth() + 1 // starts at 0
const day = d.getDate()
if (month === 10 && day > 20) {
    chrome.storage.local.set({ closedMsg1: false })
}

// DOESNT WORK IN RELEASE VERSION
chrome.storage.local.get(['openSettingsOnReload'], async (resp) => {
    if (resp.openSettingsOnReload) await openSettingsPage()
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.storage.local.set({ openSettingsOnReload: false }, resolve))
})

// command listener
// this listener behaves weirdly with an async function so it just calls async functions and returns true
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    switch (request.cmd) {
        case 'save_clicks':
            // The first one is legacy and should not be used anymore
            saveClicks(request.click_count || request.clickCount)
            break
        case 'get_user_data':
            // Asynchronous response
            credentials.getUserData(request.platform || 'zih').then(sendResponse)
            break
        case 'set_user_data': 
            // Asynchronous response
            credentials.setUserData(request.userData, request.platform || 'zih').then(() => sendResponse(true))
            break
        case 'check_user_data':
            // Asynchronous response
            credentials.userDataExists(request.platform).then(sendResponse)
            break
        case 'read_mail_owa':
            owaFetch.readMailOWA(request.nrOfUnreadMail || 0)
            break
        case 'logged_out':
            loggedOut(request.portal)
            break
        case 'disable_owa_fetch':
            owaFetch.disableOwaFetch()
            break
        case 'reload_extension':
            chrome.runtime.reload()
            break
        case 'save_courses':
            saveCourses(request.course_list)
            break
        case 'open_settings_page':
            openSettingsPage(request.params)
            break
        case 'open_share_page':
            openSharePage()
            break
        case 'open_shortcut_settings':
            if (isFirefox) {
                chrome.tabs.create({ url: 'https://support.mozilla.org/de/kb/tastenkombinationen-fur-erweiterungen-verwalten' })
            } else {
                // for chrome and everything else
                chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
            }
            break
        case 'toggle_pdf_inline_setting':
            enableHeaderListener(request.enabled)
            break
        case 'update_rocket_logo_easteregg':
            chrome.browserAction.setIcon({ path: 'assets/icons/RocketIcons/3_120px.png' })
            break
        default:
            console.log(`Cmd not found "${request.cmd}"!`)
            break
    }
    return true // required for async sendResponse
})

/**
 * enable or disable the header listener
 * modify http header from opal, to view pdf in browser without the need to download it
 * @param {true} enabled flag to enable/ disable listener
 */
function enableHeaderListener(enabled) {
    if (enabled) {
        chrome.webRequest.onHeadersReceived.addListener(
            headerListenerFunc,
            {
                urls: [
                    'https://bildungsportal.sachsen.de/opal/downloadering*',
                    'https://bildungsportal.sachsen.de/opal/*.pdf'
                ]
            },
            ['blocking', 'responseHeaders']
        )
    } else {
        chrome.webRequest.onHeadersReceived.removeListener(headerListenerFunc)
    }
}

function headerListenerFunc(details) {
    const header = details.responseHeaders.find(
        e => e.name.toLowerCase() === 'content-disposition'
    )
    if (!header?.value.includes('.pdf')) return // only for pdf
    header.value = 'inline'
    return { responseHeaders: details.responseHeaders }
}

// open settings (=options) page, if required set params
async function openSettingsPage(params?: string) {
    if (params) {
        // Promisified until usage of Manifest V3
        await new Promise<void>((resolve) => chrome.storage.local.set({ openSettingsPageParam: params }, resolve))
    }
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.runtime.openOptionsPage(resolve))
}

async function openSharePage() {
    // Promisified until usage of Manifest V3
    await new Promise((resolve) => chrome.tabs.create({ url: 'share.html' }, resolve))
}

// timeout is 2000 default
async function loggedOut(portal) {
    const timeout = portal === 'loggedOutCloudstore' ? 7000 : 2000
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.storage.local.set({ [portal]: true }, resolve))
    setTimeout(async () => {
        // Promisified until usage of Manifest V3
        await new Promise<void>((resolve) => chrome.storage.local.set({ [portal]: false }, resolve))
    }, timeout)
}

// save_click_counter
async function saveClicks(counter: number) {
    // load number of saved clicks and add counter!
    // Promisified until usage of Manifest V3
    const result = await new Promise<any>((resolve) => chrome.storage.local.get(['savedClickCounter'], resolve))
    const savedClickCounter = (typeof result.savedClickCounter === 'undefined') ? counter : result.savedClickCounter + counter
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.storage.local.set({ savedClickCounter }, () => {
        console.log('Saved ' + counter + ' clicks!')
        resolve()
    }))
    // make rocketIcons available if appropriate
    // Promisified until usage of Manifest V3
    const { availableRockets } = await new Promise<any>((resolve) => chrome.storage.local.get(['availableRockets'], resolve))
    if (savedClickCounter > 250 && !availableRockets.includes('RI4')) availableRockets.push('RI4')
    if (savedClickCounter > 2500 && !availableRockets.includes('RI5')) availableRockets.push('RI5')
    // Promisified until usage of Manifest V3
    await new Promise<void>((resolve) => chrome.storage.local.set({ availableRockets }, resolve))
}

// save parsed courses
interface CourseList {
    type: string
    list: Course[]
}
interface Course {
    link: string
    name: string
}
async function saveCourses(courseList: CourseList) {
    courseList.list.sort((a, b) => (a.name > b.name) ? 1 : -1)
    switch (courseList.type) {
        case 'favoriten':
            // Promisified until usage of Manifest V3
            await new Promise<void>((resolve) => chrome.storage.local.set({ favoriten: JSON.stringify(courseList.list) }, resolve))
            console.log('Saved Favoriten in TUfast')
            break
        case 'meine_kurse':
            // Promisified until usage of Manifest V3
            await new Promise<void>((resolve) => chrome.storage.local.set({ meine_kurse: JSON.stringify(courseList.list) }, resolve))
            console.log('Saved Meine Kurse in TUfast')
            break
    }
}