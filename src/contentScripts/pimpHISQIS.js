console.log('Pimping up hisqis...')

chrome.storage.local.get(['isEnabled'], (result) => {
  if (result.isEnabled) {
    document.addEventListener('DOMContentLoaded', () => {
      const imgUrl = chrome.runtime.getURL('../assets/images/tufast48.png')
      const rawGrades = parseGrades()
      $("table[summary!='Liste der Stammdaten des Studierenden']").parent().eq(2).children().eq(3).after(
        '<br><br><canvas id="myChart" style="margin:0 auto;"></canvas><p class="Konto" style="margin:0 auto;">Deine Durchschnittnote (nach CP gewichtet): ' + getWeightedAverage(rawGrades) + ' </p><p class="Konto" style="margin:0 auto;">Anzahl Module: ' + rawGrades.filter(x => x.isModule).length + '</p><p class="Konto" style="margin:0 auto;">Anzahl Prüfungen: ' + rawGrades.filter(x => !x.isModule).length + '</p><p class="normal" style="margin-bottom:0">powered by <img src=' + imgUrl + ' style="position:relative; right: 2px;height: 15px;"><a href="https://www.tu-fast.de">TUfast</a> (entwickelt von <a href="https://github.com/Noxdor" target="_blank">Noxdor</a>, <a href="https://github.com/C0ntroller" target="_blank">Daniel</a>)</p><p class="normal" style="margin-bottom:-20px" id="changeTable">Wechsle zur <a id="changeTableLink" href="javascript:void(0)">... nocht nicht f&uuml;r Firefox!</a></p>'
      )
      const ctx = document.getElementById('myChart').getContext('2d')
      ctx.canvas.width = 500
      ctx.canvas.height = 250
      // eslint-disable-next-line no-unused-vars, no-undef
      const myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1', '2', '3', '4', 'nicht bestanden'],
          datasets: [{
            data: countGrades(rawGrades.filter(x => !x.isModule)),
            backgroundColor: [
              '#0b2a51',
              '#0b2a51',
              '#0b2a51',
              '#0b2a51',
              '#0b2a51'
            ],
            borderColor: [
              '#0b2a51'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          legend: {
            display: false
          },
          scales: {
            yAxes: [{
              ticks: {
                beginAtZero: true
              }
            }],
            xAxes: [{
              scaleLabel: {
                // display: true,
                // labelString: "<a href='http://www.yahoo.com'>here</a>"
              }
            }]
          }
        }
      })
    })
  }
})

// returns: [{grade: X.X, isModule: true}]
// only count subjects (not modules!)
function parseGrades () {
  const grades = []
  const $ = this.$

  $("table[summary!='Liste der Stammdaten des Studierenden'] > tbody").children().each(function () {
    // Skip stuff
    if ($(this).children().attr('class') === 'Konto' ||
            $(this).children().attr('class') === 'tabelleheader' ||
            $(this).children().eq(1).text().trim() === 'Zurück' ||
            $(this).children().eq(1).attr('bgcolor') === '#ADADAD'
    ) { return true }

    let grade = $(this).children().eq(3).text().trim()
    const isModule = $(this).children().eq(1).attr('bgcolor') === '#DDDDDD'
    const exam = $(this).children().eq(1).text().trim()
    let weight = isModule ? parseInt($(this).children().eq(7).text().trim()) : 0
    if (isNaN(weight)) { weight = 0 }

    // Skip more stuff
    if (exam === '') { return true }
    if (exam === 'Gesamtnote Zwischenprüfung') { return }
    if (grade === '') { return } else { grade = parseFloat(grade.replace(',', '.')) }

    grades.push({ grade: grade, isModule: isModule, weight: weight })
  })
  return grades
}

// return counted number of rounded grades for display
// also showing failed exams which were passed later
function countGrades (rawGrades) {
  const gradesCount = [0, 0, 0, 0, 0]
  rawGrades.forEach((info) => {
    const grade = Math.round(info.grade)
    switch (grade) {
      case 1:
        gradesCount[0] = gradesCount[0] + 1
        break
      case 2:
        gradesCount[1] = gradesCount[1] + 1
        break
      case 3:
        gradesCount[2] = gradesCount[2] + 1
        break
      case 4:
        gradesCount[3] = gradesCount[3] + 1
        break
      case 5:
        gradesCount[4] = gradesCount[4] + 1
        break
      default:
        break
    }
  })
  return gradesCount
}

// return arithmetic grade average
// not counting failed exams!
// function getArithAverage (rawGrades) {
//   // first get all grade-objects that aren't failed, then map it directly as number
//   const grades = rawGrades.filter(x => x.grade !== 5.0 && !x.isModule).map(x => x.grade)
//   return grades.length ? (grades.reduce((acc, value) => acc + value, 0) / grades.length).toFixed(1) : 0
// }

// return weighted grade average
// not counting failed modules!
function getWeightedAverage (rawGrades) {
  const grades = rawGrades.filter(x => x.grade !== 5.0 && x.isModule)
  const totalWeight = grades.reduce((acc, value) => acc + value.weight, 0) // BUG:
  return totalWeight ? (grades.reduce((acc, value) => acc + value.grade * value.weight, 0) / totalWeight).toFixed(1) : 0
}
