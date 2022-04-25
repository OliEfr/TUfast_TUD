// function for custom URIEncoding
function customURIEncoding(str: string) {
    str = encodeURIComponent(str);
    str = str
        .replace("!", "%21")
        .replace("'", "%27")
        .replace("(", "%28")
        .replace(")", "%29")
        .replace("~", "%7E");
    return str;
}

// function to log msx.tu-dresden.de/owa/ and retrieve the .json containing information about EMails
export async function fetchOWA(username: string, password: string, logout: boolean) {
    // encodeURIComponent and encodeURI are not working for all chars. See documentation. Thats why I implemented custom encoding.
    username = customURIEncoding(username);
    password = customURIEncoding(password);

    // login
    await fetch("https://msx.tu-dresden.de/owa/auth.owa", {
        headers: {
            accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "accept-language":
                "de-DE,de;q=0.9,en-DE;q=0.8,en-GB;q=0.7,en-US;q=0.6,en;q=0.5",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "Access-Control-Allow-Origin": "*",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
        },
        referrer:
            "https://msx.tu-dresden.de/owa/auth/logon.aspx?replaceCurrent=1&url=https%3a%2f%2fmsx.tu-dresden.de%2fowa%2f%23authRedirect%3dtrue",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: `destination=https%3A%2F%2Fmsx.tu-dresden.de%2Fowa%2F%23authRedirect%3Dtrue&flags=4&forcedownlevel=0&username=${username}%40msx.tu-dresden.de&password=${password}&passwordText=&isUtf8=1`,
        method: "POST",
        mode: "no-cors",
        credentials: "include",
    });

    const owaResp = await fetch("https://msx.tu-dresden.de/owa/", {
        headers: {
            accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "accept-language":
                "de-DE,de;q=0.9,en-DE;q=0.8,en-GB;q=0.7,en-US;q=0.6,en;q=0.5",
            "cache-control": "max-age=0",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "Access-Control-Allow-Origin": "*",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
        },
        referrer:
            "https://msx.tu-dresden.de/owa/auth/logon.aspx?replaceCurrent=1&url=https%3a%2f%2fmsx.tu-dresden.de%2fowa",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "include",
    });

    const respText = await owaResp.text();
    const tmp = respText.split("window.clientId = '")[1];
    const clientId = tmp.split("'")[0];
    const corrId = clientId + "_" + new Date().getTime();
    //console.log("corrID: " + corrId);

    const mailInfoRsp = await fetch(
        "https://msx.tu-dresden.de/owa/sessiondata.ashx?appcacheclient=0",
        {
            headers: {
                accept: "*/*",
                "accept-language":
                    "de-DE,de;q=0.9,en-DE;q=0.8,en-GB;q=0.7,en-US;q=0.6,en;q=0.5",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "Access-Control-Allow-Origin": "*",
                "sec-fetch-site": "same-origin",
                "x-owa-correlationid": corrId,
                "x-owa-smimeinstalled": "1",
            },
            referrer: "https://msx.tu-dresden.de/owa/",
            referrerPolicy: "strict-origin-when-cross-origin",
            body: null,
            method: "POST",
            mode: "cors",
            credentials: "include",
        }
    );

    const mailInfoJson = await mailInfoRsp.json();

    // only logout, if user is not using owa in browser session
    if (logout) {
        console.log("Logging out from owa..");
        await fetch("https://msx.tu-dresden.de/owa/logoff.owa", {
            headers: {
                accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language":
                    "de-DE,de;q=0.9,en-DE;q=0.8,en-GB;q=0.7,en-US;q=0.6,en;q=0.5",
                "sec-fetch-dest": "document",
                "Access-Control-Allow-Origin": "*",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
            },
            referrer: "https://msx.tu-dresden.de/owa/",
            referrerPolicy: "strict-origin-when-cross-origin",
            body: null,
            method: "GET",
            mode: "cors",
            credentials: "include",
        });
    }

    return mailInfoJson;
}

// extract number of unread messages in owa
export function countUnreadMsg(json: any) {
    console.log(json)
    const folder = json.findFolders.Body.ResponseMessages.Items[0].RootFolder.Folders.find(
        (obj) => obj.DisplayName === "Inbox" || obj.DisplayName === "Posteingang"
    );
    return folder.UnreadCount;
}

// checks, if user currently uses owa in browser
export async function owaIsOpened() {
    const uri = 'msx.tu-dresden.de';
    const tabs = await getAllChromeTabs();
    // Find element with msx in uri, -1 if none found
    if (tabs.findIndex((element) => element.url.includes(uri)) >= 0) {
        console.log('currently opened owa');
        return true;
    } else return false;
}

async function getAllChromeTabs() {
    return await chrome.tabs.query({});
}

// start OWA fetch funtion based on interval
export async function enableOWAFetch() {
    // first, clear all alarms
    console.log('starting to fetch from owa...');
    await owaFetch();
    // clear first so no double alarms
    await chrome.alarms.clear('fetchOWAAlarm');
    chrome.alarms.create('fetchOWAAlarm', { delayInMinutes: 1, periodInMinutes: 5 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === 'fetchOWAAlarm') await owaFetch();
    });
}

export async function disableOwaFetch() {
    console.log('stopped owa connection');
    await setBadgeUnreadMails(0);
    await chrome.storage.local.remove(['numberOfUnreadMails']);
    await chrome.alarms.clear('fetchOWAAlarm');
}

export async function readMailOWA(numberOfUnreadMails: number) {
    // set badge and local storage
    await chrome.storage.local.set({ numberOfUnreadMails });
    await setBadgeUnreadMails(numberOfUnreadMails)
}

async function setBadgeUnreadMails(numberOfUnreadMails: number) {
    // set badge
    if (!numberOfUnreadMails) {
        await showBadge('', '#4cb749')
    } else if (numberOfUnreadMails > 99) {
        await showBadge('99+', '#4cb749')
    } else {
        await showBadge(numberOfUnreadMails.toString(), '#4cb749')
    }
}

// show badge
async function showBadge(text: string, color: string) {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
}

export async function owaFetch () {
    // dont logout if user is currently using owa in browser
    const logout = !(await owaIsOpened())
    console.log('executing fetch ...')
  
    // get user data
    const { user, pass } = await getUserData('zih')
    // call fetch
    const mailInfoJson = await fetchOWA(user, pass, logout)
    // check # of unread mails
    const numberOfUnreadMails = countUnreadMsg(mailInfoJson)
    console.log('Unread mails in OWA: ' + numberOfUnreadMails)
  
    // alert on new Mail
    const result = await chrome.storage.local.get(['numberOfUnreadMails', 'additionalNotificationOnNewMail']);
    if (result.additionalNotificationOnNewMail && typeof result.numberOfUnreadMails !== 'undefined' && result.numberOfUnreadMails < numberOfUnreadMails) {
        // Promissified notification
        await new Promise<void>((resolve) => chrome.notifications.create(
            'tuFastNewEmailNotification',
            {
                type: 'basic',
                message: `Du hast ${numberOfUnreadMails} neue E-Mails`,
                title: 'Neue E-Mails',
                iconUrl: 'assets/icons/RocketIcons/default_128px.png'
            },
            (_id) => resolve(undefined),
        ));
    }
  
    // set badge and local storage
    // Promisified until usage of Manifest V3
    await chrome.storage.local.set({ numberOfUnreadMails });
    await setBadgeUnreadMails(numberOfUnreadMails)
  }