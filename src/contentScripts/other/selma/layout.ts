const currentView = document.location.pathname
// Regex for extracting Programm name and arguments from a popup Script
// This is used to get the URL which would be opened in a popup
const popupScriptsRegex =
    /dl_popUp\("\/scripts\/mgrqispi\.dll\?APPNAME=CampusNet&PRGNAME=(\w+)&ARGUMENTS=([^"]+)"/

function scriptToURL (script: string): string {
  const matches = script.match(popupScriptsRegex)!

  const porgamName = matches.at(1)!
  const prgArguments = matches.at(2)!

  return `https://selma.tu-dresden.de/APP/${porgamName}/${prgArguments}`
}

function mapGrade (gradeElm: Element) {
  const grade = gradeElm.textContent!

  if (grade.includes('be')) {
    gradeElm.textContent = '✔'
    gradeElm.setAttribute('title', 'Bestanden')
  } else if (grade.includes('noch nicht gesetzt')) {
    gradeElm.textContent = '🕓'
    gradeElm.setAttribute('title', 'Noch nicht gesetzt')
  }
}

function injectCSS (filename: string) {
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.type = 'text/css'
  style.href = chrome.runtime.getURL(
    `styles/contentScripts/selma/${filename}.css`
  );

  (document.head || document.body || document.documentElement).appendChild(
    style
  )
}

/*
---

Proabably a proper bundler config would be better

---
*/

namespace Graphing {
  export type GradeStat = {
    grade: number;
    count: number;
  };

  function maxGradeCount (values: GradeStat[]): number {
    let max = 0
    for (const { count } of values) {
      if (count > max) max = count
    }
    return max
  }

  // Reduce the grade increments
  function pickGradeSubset (values: GradeStat[]): GradeStat[] {
    const increments = [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 5]

    const newValues = increments.map((inc) => ({
      grade: inc,
      count: 0
    }))

    let currentIncIndex = 0
    for (const { grade, count } of values) {
      // Skip to next increment if we reached it's lower end
      if (currentIncIndex !== increments.length - 1) {
        const nextIncrement = increments[currentIncIndex + 1]
        if (grade >= nextIncrement) currentIncIndex++
      }
      newValues[currentIncIndex].count += count
    }

    return newValues
  }

  export function createSVGGradeDistributionGraph (
    values: GradeStat[],
    url: string,
    ownGrade: number,
    width = 200,
    height = 100
  ): string {
    // Reduce the bar count / pick bigger intervals
    const coarseValues = pickGradeSubset(values)

    // Spacing in percent of bar width
    const spacing = 0.1
    const barWidth = (width * (1 - spacing)) / coarseValues.length

    // Drawing the Chart
    let barsSvg = ''
    const maxCount = maxGradeCount(coarseValues)
    for (let x = 0; x < coarseValues.length; x++) {
      const { grade, count } = coarseValues[x]
      const barHeight = (count / maxCount) * height

      // Allows styling the failed sections differently
      let className = 'passed'
      if (grade >= 5.0) {
        if (ownGrade === grade) {
          className = 'failedgrade'
        } else {
          className = 'failed'
        }
      } else if (grade === ownGrade) {
        className = 'grade'
      }
      if (ownGrade === -1) {
        className = 'nograde'
      } else if (ownGrade === -10) {
        className = 'animate-loading'
      }
      // 99 are any unhandled grade variants
      // add handling as needed

      barsSvg += `
            <rect
              class="${className}"
              x="${x * barWidth * (1 + spacing)}" y="${height - barHeight}"
              width="${barWidth}" height="${barHeight}"
              rx="5" ry="5"
            >
              <title>${grade.toFixed(2)}</title>
            </rect>
          `
    }

    return `
      <svg
        class="distribution-chart"
        viewBox="0 0 ${width} ${height}"
        xmlns="http://www.w3.org/2000/svg">
         <!-- Allows the user to still see the detailed grade overview page -->
        <a href="${url}" target="popup">
          <!-- Necessary so the whole chart is clickable -->
          <rect
            x="0" y="0" width="${width}" height="${height}"
            fill="transparent"
          />
          ${barsSvg}
        </a>
      </svg>
    `
  }

  export type Try = { date: string; grade: string };

  export function createJExamTryCounter (
    tries: Try[],
    url: string,
    width = 200
  ): string {
    // Spacing in percent of circle width
    const spacing = 0.2
    // Stroke width in percent of radius
    const strokeWidth = 0.12

    const filledRadius = (width * (1 - spacing)) / 6
    const strokedRadius = filledRadius * (1 - strokeWidth)
    // +1 to prevent weird cut off
    const height = Math.ceil(2 * filledRadius) + 1

    // Drawing the Chart
    let svgContent = ''

    for (let x = 0; x < 3; x++) {
      let className = 'used'
      let tooltip = ''
      if (x >= tries.length) {
        // Mark open try
        className = 'open'
      } else {
        const { date, grade } = tries[x]
        tooltip = `<title>${grade}\n${date}</title>`
      }

      svgContent += `
            <circle
              class="${className}"
              stroke-width="${strokeWidth * height}"
              cx="${2 * x * filledRadius * (1 + spacing) + filledRadius}"
              cy="${filledRadius}"
              r="${className === 'used' ? filledRadius : strokedRadius}"
            >
              ${tooltip}
            </circle>
          `
    }

    return `
      <svg
        class="tries-counter"
        viewBox="0 0 ${width} ${height}"
        xmlns="http://www.w3.org/2000/svg">
         <!-- Allows the user to still see the detailed grade overview page -->
        <a href="${url}" target="popup">
          <!-- Necessary so the whole chart is clickable -->
          <rect
            x="0" y="0" width="${width}" height="${height}"
            fill="transparent"
          />
          ${svgContent}
        </a>
      </svg>
    `
  }
}

/*
---

Actual logic

---
*/

// Create a small banner that indicates the user that the site was modified
// It also adds a small toggle to disable the table
async function createCreditsBanner () {
  const { improveSelma: settingEnabled } = await chrome.storage.local.get(['improveSelma'])

  const imgUrl = chrome.runtime.getURL('/assets/images/tufast48.png')
  const credits = document.createElement('p')

  credits.style.margin = 'auto'
  credits.style.marginRight = '0'
  credits.style.color = '#002557' // Selma theme color
  credits.id = 'TUfastCredits'
  credits.innerHTML = `Table ${settingEnabled ? 'powered by' : 'disabled'}
    <img src="${imgUrl}" style="position:relative; right: 2px; height: 0.7lh; top: 0.15lh; padding-left: 0.1lh;">
    <a href="https://www.tu-fast.de" target="_blank">TUfast</a>
    by <a href="https://github.com/A-K-O-R-A" target="_blank">AKORA</a>, <a href="https://github.com/t0mbrn" target="_blank">Tom</a>
    `

  const disableButton = document.createElement('button')
  // Similiar style to logout button
  disableButton.setAttribute(
    'style',
    `
    border: 1px solid rgb(255, 255, 255);
    color: rgb(221, 39, 39);
    text-decoration: none;
    padding: 0.5rem 1rem;
    margin: 0 1rem;
    border-radius: 0px;
    `
  )

  // Tooltip
  disableButton.title =
    'Toggle the "ImproveSelma" feature and reload the page to apply the change.'
  disableButton.textContent = settingEnabled ? 'Deactivate' : 'Activate'
  disableButton.onclick = async (event) => {
    event.preventDefault()
    await chrome.storage.local.set({ improveSelma: !settingEnabled })
    window.location.reload()
  }
  credits.appendChild(disableButton)

  return credits
}

(async () => {
  const { improveSelma } = await chrome.storage.local.get(['improveSelma'])

  // Apply all custom changes
  document.addEventListener('DOMContentLoaded', async () => {
    // Add Credit banner with toggle button
    const creditElm = await createCreditsBanner()
    document.querySelector('.semesterChoice')!.appendChild(creditElm)

    if (!improveSelma) return

    eventListener()
  })
  document.addEventListener('DOMContentLoaded', eventListener, false)
})()

async function eventListener () {
  document.removeEventListener('DOMContentLoaded', eventListener)

  // Inject css
  injectCSS('base')
  if (
    currentView.startsWith('/APP/EXAMRESULTS/') ||
    currentView.startsWith('/APP/COURSERESULTS/')
  ) {
    injectCSS('exam_results')
  }
  if (currentView.startsWith('/APP/MYEXAMS/')) {
    injectCSS('my_exams')
  }

  applyChanges()
}

// default values for Notenübersicht, when table is null
const NULL_TABLE = [
  {
    grade: 1,
    count: 1
  },
  {
    grade: 1.3,
    count: 1
  },
  {
    grade: 1.7,
    count: 1
  },
  {
    grade: 2,
    count: 1
  },
  {
    grade: 2.3,
    count: 1
  },
  {
    grade: 2.7,
    count: 1
  },
  {
    grade: 3,
    count: 1
  },
  {
    grade: 3.3,
    count: 1
  },
  {
    grade: 3.7,
    count: 1
  },
  {
    grade: 4,
    count: 1
  },
  {
    grade: 5,
    count: 1
  }
]

function applyChanges () {
  if (currentView.startsWith('/APP/EXAMRESULTS/')) {
    // Prüfungen > Ergebnisse

    // Remove the "gut/befriedigend" section
    const headRow = document.querySelector('thead>tr')!
    headRow.children.item(3)!.textContent = 'Notenverteilung'
    headRow.removeChild(headRow.children.item(4)!)

    const body = document.querySelector('tbody')!
    const promises: Promise<{ doc: Document; elm: Element; url: string; ownGrade: number}>[] =
        []
    for (const row of body.children) {
      // Remove useless inline styles which set the vertical alignment
      for (const col of row.children) col.removeAttribute('style')

      row.removeChild(row.children.item(3)!)

      // Extract script content
      const lastCol = row.children.item(3)!
      const scriptElm = lastCol.children.item(1)
      if (scriptElm === null) continue

      const scriptContent = scriptElm!.innerHTML

      const url = scriptToURL(scriptContent)

      // loading animation
      lastCol.innerHTML = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -10)

      let ownGradeNum = 0
      const gradeElm = row.children.item(2)?.innerHTML.trim()
      if (gradeElm?.includes(',')) {
        let ownGrade: string
        const grade = (gradeElm + '').split(',')
        let first = Number(grade[0])
        const second = Number(grade[1])
        if (second > 70) {
          ownGrade = (first++).toString() + '.0'
        } else if (second > 30) {
          ownGrade = first.toString() + '.7'
        } else if (second > 0) {
          ownGrade = first.toString() + '.3'
        } else {
          ownGrade = first.toString() + '.0'
        }
        ownGradeNum = Number(ownGrade)
      } else if (gradeElm?.includes('be')) {
        ownGradeNum = 1
      } else {
        // default exception case, maybe expand as needed
        ownGradeNum = -99
      }

      promises.push(
        fetch(url).then(async (s) => {
          const parser = new DOMParser()
          const doc = parser.parseFromString(await s.text(), 'text/html')

          return { doc, elm: lastCol, url, ownGrade: ownGradeNum }
        })
      )
    }

    promises.forEach((p) =>
      p.then(({ doc, elm, url, ownGrade }) => {
        const tableBody = doc.querySelector('tbody')!
        let graphSVG
        if (tableBody === null) {
          // No grades available
          graphSVG = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -1)
        } else {
          const values = [...tableBody.children].map((tr) => {
            const gradeText = tr.children.item(0)!.textContent!.replace(',', '.')
            const grade = parseFloat(gradeText)

            const countText = tr.children.item(1)!.textContent!
            let count: number
            if (countText === '---') count = 0
            else count = parseInt(countText)

            return {
              grade,
              count
            }
          })
          graphSVG = Graphing.createSVGGradeDistributionGraph(values, url, ownGrade)
        }
        elm.innerHTML = graphSVG
      }).catch(({ elm, url }) => {
        elm.innerHTML = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -1)
      })
    )

    // Remove the inline style that sets a width on the top right table cell
    const tableHeadRow = document.querySelector('thead>tr')!
    tableHeadRow.children.item(3)!.removeAttribute('style')
    /*

*/
  } else if (currentView.startsWith('/APP/COURSERESULTS/')) {
    // Prüfungen > Ergebnisse

    // Remove the "bestanden" section
    const headRow = document.querySelector('thead>tr')!
    headRow.removeChild(headRow.children.item(3)!)
    headRow.children.item(3)!.textContent = 'Versuche'

    // Add "Notenverteilung" header
    {
      headRow.children.item(3)!.removeAttribute('colspan')
      const newHeader = document.createElement('th')
      newHeader.textContent = 'Notenverteilung'
      headRow.appendChild(newHeader)
    }

    // Create the grade distribution graph
    const body = document.querySelector('tbody')!
    const promises: Promise<{ doc: Document; elm: Element; url: string, ownGrade:number }>[] =
            []

    for (const row of body.children) {
      // Remove useless inline styles which set the vertical alignment
      for (const col of row.children) col.removeAttribute('style')

      // Remove "Status" column
      row.removeChild(row.children.item(3)!)

      {
        // Map grade descriptions to emojis
        const gradeElm = row.children.item(2)!
        mapGrade(gradeElm)
      }

      // Extract script content
      const lastCol = row.children.item(4)!
      const scriptElm = lastCol.children.item(1)
      // Skip courses wihtout grades
      if (scriptElm === null) continue

      let ownGradeNum = 0
      const gradeElm = row.children.item(2)?.innerHTML.trim()
      if (gradeElm?.includes(',')) {
        let ownGrade: string
        const grade = (gradeElm + '').split(',')
        let first = Number(grade[0])
        const second = Number(grade[1])
        if (second > 7) {
          ownGrade = (first++).toString() + '.0'
        } else if (second > 3) {
          ownGrade = first.toString() + '.7'
        } else if (second > 0) {
          ownGrade = first.toString() + '.3'
        } else {
          ownGrade = first.toString() + '.0'
        }
        ownGradeNum = Number(ownGrade)
      } else if (gradeElm?.includes('be')) {
        ownGradeNum = 1
      } else {
        // default exception case, maybe expand as needed
        ownGradeNum = -99
      }

      const scriptContent = scriptElm!.innerHTML

      const url = scriptToURL(scriptContent)
      // loading animation
      lastCol.innerHTML = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -10)

      promises.push(
        fetch(url).then(async (s) => {
          const parser = new DOMParser()
          const doc = parser.parseFromString(await s.text(), 'text/html')

          return { doc, elm: lastCol, url, ownGrade: ownGradeNum }
        })
      )
    }

    promises.forEach((p) =>
      p.then(({ doc, elm, url, ownGrade }) => {
        // Parse the grade distributions
        const tableBody = doc.querySelector('tbody')!
        let graphSVG
        if (tableBody === null) {
          // No grades available
          graphSVG = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -1)
        } else {
          const values = [...tableBody.children].map((tr) => {
            const gradeText = tr.children.item(0)!.textContent!.replace(',', '.')
            const grade = parseFloat(gradeText)

            const countText = tr.children.item(1)!.textContent!
            let count: number
            if (countText === '---') count = 0
            else count = parseInt(countText)

            return {
              grade,
              count
            }
          })
          graphSVG = Graphing.createSVGGradeDistributionGraph(values, url, ownGrade)
        }
        // .slice(0, -2); // Remove the 5.0 from all lists

        // Present the bar chart
        elm.innerHTML = graphSVG
      }).catch(({ elm, url }) => {
        elm.innerHTML = Graphing.createSVGGradeDistributionGraph(NULL_TABLE, url, -1)
      })
    )

    // Remove the inline style that sets a width on the top right table cell
    const tableHeadRow = document.querySelector('thead>tr')!
    tableHeadRow.children.item(3)!.removeAttribute('style')

    // Draw try counter in the jExam style
    for (const row of body.children) {
      const linkElm = row.children.item(3)!
      const scriptElm = linkElm.children.item(1)
      // Skip courses wihtout grades
      if (scriptElm === null) continue

      // Extract script content
      const scriptContent = scriptElm!.innerHTML
      const url = scriptToURL(scriptContent)

      // Center the remaining "> Prüfung" links so it looks better after everything loaded
      linkElm.setAttribute('style', 'text-align: center;')

      // Fetch data
      fetch(url).then(async (s) => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(await s.text(), 'text/html')

        // Extracting the grades of individual tries
        const tableBody = doc.querySelector('tbody')!
        const tries: Graphing.Try[] = []

        // Search for tries
        for (let i = 0; i < tableBody.children.length; i++) {
          const trElm = tableBody.children.item(i)!
          const firstTd = trElm.querySelector('td.level02')

          // Before a row with a grade there is always a row containing "Modulprüfung"
          if (firstTd !== null && firstTd.textContent === 'Modulprüfung') {
            // Next row will contain a try with a grade
            let nextTrElm = tableBody.children.item(i + 1)!
            // Sometimes there is an extra row
            if (nextTrElm.children.length === 1) {
              nextTrElm = tableBody.children.item(i + 2)!
            }

            // Extract information
            const date = nextTrElm.children.item(2)!.textContent!.trim()
            const grade = nextTrElm.children.item(3)!.textContent!.trim()
            tries.push({ date, grade })

            i += 2
          }
        }

        // Unable to parse the grades from the tables
        if (tries.length === 0) return

        // Replace link with a chart
        linkElm.innerHTML = Graphing.createJExamTryCounter(tries, url)
      })
    }

    /*

*/
  } else if (currentView.startsWith('/APP/MYEXAMS/')) {
    // Prüfungen

    const body = document.querySelector('tbody')!
    const rows = [...body.children]
    for (let i = 0; i < rows.length; i += 2) {
      const topRow = rows[i]
      const botRow = rows[i + 1]

      const thElm = topRow.children.item(0)!
      thElm.className += ' module-description'
      // moduleCode, hyperlink, space, br, description
      const [, , , , description] = thElm.childNodes

      {
        // Move exam type and examinant to the right side
        thElm.setAttribute('colspan', '2')
        const newSpacer = document.createElement('th')
        newSpacer.setAttribute('colspan', '2')
        newSpacer.replaceChildren(...botRow.children.item(1)!.children)
        topRow.appendChild(newSpacer)
      }

      {
        // Move the description under the exam title
        // Remove useless first element
        botRow.removeChild(botRow.children.item(1)!)
        const newDescriptionElm = botRow.children.item(0)!
        newDescriptionElm.setAttribute('colspan', '2')
        newDescriptionElm.className += ' module-description'

        // Some entries do not have a description
        if (thElm.childNodes.length === 5) {
          newDescriptionElm.appendChild(description)
        }
      }

      {
        // Remove useless timespans
        const dateElm = botRow.children.item(1)!
        dateElm.textContent = dateElm.textContent!.replaceAll(
          '00:00-00:00',
          ''
        )
      }
    }
    // Table head "Prüfungsleistung"
    document.querySelector('thead > tr > th#Name')!.textContent = ''
    // Table head "Termin"
    document.querySelector('thead > tr > th#Date')!.textContent =
        'Prüfungsleistung/Termin'
    // Append extra bar to head
    const headRow = document.querySelector('thead>tr')!
    headRow.removeChild(headRow.children.item(3)!)
  }
}
