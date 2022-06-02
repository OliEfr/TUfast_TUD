import { DataTable } from 'simple-datatables'

(async () => {
  // Get the container for the information
  // Currently this means there's the link located for switching the tables
  const tableInfoContainer = document.getElementById('TUfastTableInfo')
  if (!tableInfoContainer) return

  // The old table and it's content
  const oldTable = document.getElementsByTagName('table')[2]
  if (!oldTable) return
  const oldTableRows = (oldTable as HTMLTableElement).querySelectorAll('tr')

  // Create a new table
  const newTable = document.createElement('table')
  newTable.id = 'gradeTable'

  // Caption for our new table
  const newTableCaption = document.createElement('caption')
  newTableCaption.innerText = 'Deine Notenübersicht'

  // Header for the new table
  const newTableHead = document.createElement('thead')
  const newTableHeadRow = document.createElement('tr')
  for (const th of oldTableRows[1].getElementsByTagName('th')) {
    const newTh = document.createElement('th')
    newTh.style.textAlign = th.align
    newTh.style.width = th.width
    newTh.innerHTML = th.innerHTML
    newTableHeadRow.append(newTh)
  }
  newTableHead.appendChild(newTableHeadRow)

  // Body for the new table
  const newTableBody = document.createElement('tbody')
  // Create rows from the old table
  for (const oldRow of oldTableRows) {
    const cells = oldRow.getElementsByTagName('td')
    if (cells.length < 11) continue

    const newRow = document.createElement('tr')
    for (const cell of cells) {
      const newCell = document.createElement('td')
      newCell.style.textAlign = cell.align
      //newCell.style.width = cell.width
      newCell.innerText = cell.innerText
      newRow.appendChild(newCell)
    }

    switch (true) {
      case cells[0].bgColor === '#ADADAD':
        newRow.className = 'meta'
        break
      case cells[0].bgColor === '#DDDDDD':
        newRow.className = 'module'
        break
      case Number.parseFloat(cells[3].textContent.trim().replace(',', '.')) === 5:
        newRow.className = 'exam-nopass'
        break
      default:
        newRow.className = 'exam'
    }
    newTableBody.appendChild(newRow)
  }

  // Append everything together
  newTable.append(newTableCaption, newTableHead, newTableBody)

  let { hisqisPimpedTable } = { hisqisPimpedTable: true } // await new Promise<any>((resolve) => chrome.storage.local.get(['hisqisPimpedTable'], resolve))
  if (hisqisPimpedTable) oldTable.style.display = 'none'
  else newTable.style.display = 'none'

  oldTable.parentNode.insertBefore(newTable, oldTable)

  const dataTable = new DataTable(newTable, {
    sortable: true,
    searchable: false,
    paging: false,
    columns: [
      { select: 10, type: 'date', format: 'DD.MM.YYYY' },
    ]
  })

  // Now we need the link to switch the tables
  const p = document.createElement('p')
  p.className = 'info'

  const changeLink = document.createElement('a')
  changeLink.innerText = hisqisPimpedTable ? 'langweiligen, alten Tabelle...' : 'neuen, coolen TUfast-Tabelle 🔥'
  changeLink.addEventListener('click', async () => {
    hisqisPimpedTable = !hisqisPimpedTable
    newTable.style.display = hisqisPimpedTable ? 'table' : 'none'
    oldTable.style.display = hisqisPimpedTable ? 'none' : 'table'
    // await new Promise<void>((resolve) => chrome.storage.local.set({ hisqisPimpedTable }, resolve))
  })

  p.append(document.createTextNode(' Weiter zur '), changeLink)
  tableInfoContainer.appendChild(p)
})()
