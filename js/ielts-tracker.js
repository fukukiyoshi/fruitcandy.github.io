(function () {
  'use strict'

  var MODULES = ['听力', '阅读', '写作', '口语']
  var state = { goal: 7.5, records: [], advice: '' }

  function isTrackerPage() {
    return /^\/shuoshuo(?:\/|\/index\.html)?$/.test(window.location.pathname)
  }

  async function loadState() {
    var response = await fetch('/data/ielts-records.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var published = await response.json()
    if (!Array.isArray(published.records) || !Number.isFinite(published.goal)) throw new Error('Invalid study data')
    state = { goal: published.goal, records: published.records, advice: published.advice || '' }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function numberOrZero(value) {
    var number = Number(value)
    return Number.isFinite(number) ? number : 0
  }

  function sortedRecords() {
    return state.records.slice().sort(function (a, b) {
      return (a.date + a.createdAt).localeCompare(b.date + b.createdAt)
    })
  }

  function scoredRecords() {
    return sortedRecords().filter(function (record) { return numberOrZero(record.score) > 0 })
  }

  function latestScores() {
    return MODULES.reduce(function (result, module) {
      var records = scoredRecords().filter(function (record) { return record.module === module })
      result[module] = records.length ? numberOrZero(records[records.length - 1].score) : null
      return result
    }, {})
  }

  function formatMinutes(minutes) {
    minutes = numberOrZero(minutes)
    if (!minutes) return '0 分钟'
    if (minutes < 60) return minutes + ' 分钟'
    var hours = Math.floor(minutes / 60)
    var rest = minutes % 60
    return hours + ' 小时' + (rest ? ' ' + rest + ' 分钟' : '')
  }

  function createMarkup() {
    return [
      '<section class="ielts-tracker" aria-label="雅思学习记录">',
      '  <header class="ielts-hero">',
      '    <div>',
      '      <span class="ielts-eyebrow">IELTS STUDY LOG</span>',
      '      <h2>雅思学习站</h2>',
      '      <p>今天的每一点练习，都在把目标变成坐标。</p>',
      '    </div>',
      '    <span class="ielts-readonly">学习足迹 · 公开展示</span>',
      '  </header>',
      '  <div class="ielts-stat-grid">',
      '    <article class="ielts-stat ielts-goal-card"><span>目标分数</span><strong data-stat="goal">—</strong><small>总分目标</small></article>',
      '    <article class="ielts-stat"><span>最近测试</span><strong data-stat="latest">—</strong><small data-stat="latest-module">还没有分数记录</small></article>',
      '    <article class="ielts-stat"><span>累计学习</span><strong data-stat="minutes">0 分钟</strong><small data-stat="days">0 个学习日</small></article>',
      '    <article class="ielts-stat"><span>单词 / 套题</span><strong data-stat="practice">0 / 0</strong><small>累计完成</small></article>',
      '  </div>',
      '  <div class="ielts-targets" data-targets></div>',
      '  <div class="ielts-panel ielts-calendar-panel"><div class="ielts-panel-heading"><div><span>DAILY PRACTICE</span><h3>学习日历</h3></div><label>年份 <select class="ielts-year" aria-label="日历年份"></select></label></div><p data-calendar-summary></p><div class="ielts-calendar-scroll"><div class="ielts-calendar" data-calendar></div></div><div class="ielts-heat-legend"><span>未记录</span><i data-level="0"></i><i data-level="1"></i><span>1–29 分钟</span><i data-level="2"></i><span>30–59</span><i data-level="3"></i><span>60–119</span><i data-level="4"></i><span>≥120</span></div><p class="ielts-caption">同一天各模块时长相加；空白日期表示没有已发布的学习时长。</p></div>',
      '  <div class="ielts-panel ielts-chart-panel">',
      '    <div class="ielts-panel-heading"><div><span>成长轨迹</span><h3>模考分数趋势</h3></div><div class="ielts-legend"></div></div>',
      '    <div class="ielts-chart-wrap"><canvas class="ielts-chart" aria-label="雅思模考分数趋势图"></canvas><div class="ielts-chart-empty">记录一次带分数的练习后，这里会出现成长曲线。</div></div>',
      '  </div>',
      '  <div class="ielts-lower-grid">',
      '    <div class="ielts-panel ielts-advice-panel">',
      '      <div class="ielts-panel-heading"><div><span>STUDY NOTES</span><h3>明日学习建议</h3></div></div>',
      '      <div class="ielts-advice" data-advice><p>添加学习记录后，我会根据你的投入与分数变化安排明天的练习。</p></div>',
      '    </div>',
      '    <div class="ielts-panel ielts-record-panel">',
      '      <div class="ielts-panel-heading"><div><span>RECENT LOG</span><h3>最近记录</h3></div></div>',
      '      <div class="ielts-records" data-records></div>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('')
  }

  function mount() {
    if (!isTrackerPage() || document.querySelector('.ielts-tracker')) return
    var article = document.querySelector('#article-container')
    if (!article) return
    article.insertAdjacentHTML('beforebegin', createMarkup())
    var root = document.querySelector('.ielts-tracker')
    loadState().then(function () {
      if (!root.isConnected) return
      setupCalendar()
      render()
    }).catch(function () {
      if (root.isConnected) root.innerHTML = '<div class="ielts-panel" role="status">学习记录暂时无法加载，请稍后刷新。</div>'
    })
  }

  function render() {
    renderStats()
    renderRecords()
    requestAnimationFrame(drawChart)
    renderTargets()
    renderCalendar()
    renderAdvice()
  }

  function renderStats() {
    var root = document.querySelector('.ielts-tracker')
    var records = sortedRecords()
    var scored = scoredRecords()
    var latest = scored[scored.length - 1]
    var totalMinutes = records.reduce(function (sum, record) { return sum + numberOrZero(record.minutes) }, 0)
    var totalWords = records.reduce(function (sum, record) { return sum + numberOrZero(record.words) }, 0)
    var totalSets = records.reduce(function (sum, record) { return sum + numberOrZero(record.sets) }, 0)
    var days = new Set(records.map(function (record) { return record.date })).size
    root.querySelector('[data-stat="goal"]').textContent = state.goal.toFixed(1)
    root.querySelector('[data-stat="latest"]').textContent = latest ? numberOrZero(latest.score).toFixed(1) : '—'
    root.querySelector('[data-stat="latest-module"]').textContent = latest ? latest.module + ' · ' + latest.date : '还没有分数记录'
    root.querySelector('[data-stat="minutes"]').textContent = formatMinutes(totalMinutes)
    root.querySelector('[data-stat="days"]').textContent = days + ' 个学习日'
    root.querySelector('[data-stat="practice"]').textContent = totalWords + ' / ' + totalSets
  }

  function renderRecords() {
    var container = document.querySelector('[data-records]')
    var records = sortedRecords().reverse().slice(0, 8)
    if (!records.length) {
      container.innerHTML = '<div class="ielts-empty-log"><i class="fa-regular fa-calendar-check"></i><p>第一条记录，会是这段旅程的起点。</p></div>'
      return
    }
    container.innerHTML = records.map(function (record) {
      var facts = []
      if (record.minutes) facts.push(record.minutes + ' 分钟')
      if (record.words) facts.push(record.words + ' 个单词')
      if (record.sets) facts.push(record.sets + ' 套题')
      return '<article class="ielts-log-item">' +
        '<div class="ielts-log-date"><strong>' + escapeHtml(record.date.slice(8)) + '</strong><span>' + escapeHtml(record.date.slice(0, 7)) + '</span></div>' +
        '<div class="ielts-log-main"><div><span class="ielts-module ielts-module-' + MODULES.indexOf(record.module) + '">' + escapeHtml(record.module) + '</span>' +
        (record.score ? '<strong class="ielts-score">' + numberOrZero(record.score).toFixed(1) + '</strong>' : '') + '</div>' +
        '<p>' + escapeHtml(facts.join(' · ') || '完成了一次学习') + '</p>' +
        (record.note ? '<small>' + escapeHtml(record.note) + '</small>' : '') + '</div>' +
        '</article>'
    }).join('')
  }

  function drawChart() {
    var canvas = document.querySelector('.ielts-chart')
    if (!canvas) return
    var records = scoredRecords().slice(-20)
    var empty = document.querySelector('.ielts-chart-empty')
    canvas.hidden = !records.length
    empty.hidden = Boolean(records.length)
    renderLegend()
    if (!records.length) return

    var ratio = Math.min(window.devicePixelRatio || 1, 2)
    var width = canvas.parentElement.clientWidth
    var height = 280
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    var ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    var dark = document.documentElement.getAttribute('data-theme') === 'dark'
    var color = dark ? 'rgba(255,255,255,.17)' : 'rgba(31,37,51,.12)'
    var textColor = dark ? 'rgba(255,255,255,.62)' : 'rgba(31,37,51,.58)'
    var colors = ['#6c8ff5', '#54b894', '#ef9a58', '#b07add']
    var pad = { left: 36, right: 18, top: 20, bottom: 38 }
    var chartWidth = width - pad.left - pad.right
    var chartHeight = height - pad.top - pad.bottom

    ctx.font = '12px sans-serif'
    ctx.fillStyle = textColor
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    for (var score = 0; score <= 9; score += 1.5) {
      var y = pad.top + chartHeight - score / 9 * chartHeight
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke()
      ctx.fillText(score.toFixed(1), 4, y + 4)
    }

    var dates = Array.from(new Set(records.map(function (record) { return record.date })))
    var xAt = function (date) {
      var index = dates.indexOf(date)
      return pad.left + (dates.length === 1 ? chartWidth / 2 : index / (dates.length - 1) * chartWidth)
    }
    var yAt = function (score) { return pad.top + chartHeight - numberOrZero(score) / 9 * chartHeight }

    MODULES.forEach(function (module, moduleIndex) {
      var points = records.filter(function (record) { return record.module === module })
      if (!points.length) return
      ctx.strokeStyle = colors[moduleIndex]
      ctx.fillStyle = colors[moduleIndex]
      ctx.lineWidth = 2.5
      ctx.beginPath()
      points.forEach(function (record, index) {
        var x = xAt(record.date), y = yAt(record.score)
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()
      points.forEach(function (record) {
        var x = xAt(record.date), y = yAt(record.score)
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = dark ? '#202128' : '#fff'; ctx.lineWidth = 2; ctx.stroke()
      })
    })

    ctx.fillStyle = '#ef6d7a'
    ctx.strokeStyle = '#ef6d7a'
    ctx.setLineDash([6, 5])
    var goalY = yAt(state.goal)
    ctx.beginPath(); ctx.moveTo(pad.left, goalY); ctx.lineTo(width - pad.right, goalY); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillText('总分目标 ' + state.goal.toFixed(1), Math.max(pad.left, width - 104), goalY - 7)

    var labelStep = Math.max(1, Math.ceil(dates.length / 5))
    dates.forEach(function (date, index) {
      if (index % labelStep && index !== dates.length - 1) return
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.fillText(date.slice(5).replace('-', '/'), xAt(date), height - 12)
    })
    ctx.textAlign = 'start'
  }

  function renderLegend() {
    var colors = ['#6c8ff5', '#54b894', '#ef9a58', '#b07add']
    var scores = latestScores()
    document.querySelector('.ielts-legend').innerHTML = MODULES.map(function (module, index) {
      return '<span><i style="background:' + colors[index] + '"></i>' + module + (scores[module] ? ' ' + scores[module].toFixed(1) : '') + '</span>'
    }).join('')
  }

  function localAdvice() {
    var records = sortedRecords()
    if (!records.length) return ['先完成一次 30–45 分钟的摸底练习，记录模块、耗时与分数。', '不用追求完美数据，连续记录三天比第一天做很多更重要。']
    var lastSevenDate = new Date(); lastSevenDate.setDate(lastSevenDate.getDate() - 6)
    var cutoff = lastSevenDate.toISOString().slice(0, 10)
    var recent = records.filter(function (record) { return record.date >= cutoff })
    var minutesByModule = MODULES.reduce(function (result, module) {
      result[module] = recent.filter(function (record) { return record.module === module }).reduce(function (sum, record) { return sum + numberOrZero(record.minutes) }, 0)
      return result
    }, {})
    var scores = latestScores()
    var scoredModules = MODULES.filter(function (module) { return scores[module] != null })
    var weakest = scoredModules.sort(function (a, b) { return scores[a] - scores[b] })[0]
    var neglected = MODULES.slice().sort(function (a, b) { return minutesByModule[a] - minutesByModule[b] })[0]
    var totalMinutes = recent.reduce(function (sum, record) { return sum + numberOrZero(record.minutes) }, 0)
    var result = []
    if (weakest) result.push('优先练习' + weakest + '：目前最近分数为 ' + scores[weakest].toFixed(1) + '，建议安排 45–60 分钟专项训练，并在结束后复盘错因。')
    else result.push('明天做一套计时小测并录入分数，先建立可以比较的基线。')
    if (neglected && neglected !== weakest) result.push('给' + neglected + '留出至少 25 分钟，避免四个模块的投入失衡。')
    if (totalMinutes < 180) result.push('过去 7 天累计 ' + formatMinutes(totalMinutes) + '；先把明天的最小目标定为 30 分钟，完成比加量更重要。')
    else result.push('过去 7 天累计 ' + formatMinutes(totalMinutes) + '，节奏不错；明天保留 10 分钟整理错误清单。')
    return result.slice(0, 3)
  }

  function renderAdvice() {
    var container = document.querySelector('[data-advice]')
    container.innerHTML = state.advice
      ? '<p>' + escapeHtml(state.advice).replace(/\n/g, '<br>') + '</p><small>已发布的学习建议</small>'
      : '<ul>' + localAdvice().map(function (item) { return '<li>' + escapeHtml(item) + '</li>' }).join('') + '</ul><small>根据公开记录生成的规则建议</small>'
  }

  // A planning allocation, not a prediction: receptive skills +0.5,
  // productive skills -0.5. Half-band ranges allow room for improvement.
  function targetRanges() {
    return MODULES.map(function (module, index) {
      var low = Math.max(0, Math.min(9, state.goal + (index < 2 ? 0.5 : -0.5)))
      return { module: module, low: low, high: Math.min(9, low + 0.5) }
    })
  }

  function renderTargets() {
    var scores = latestScores()
    var ranges = targetRanges()
    document.querySelector('[data-targets]').innerHTML = ranges.map(function (target) {
      return '<article class="ielts-stat"><span>' + target.module + ' · 参考目标</span><strong>' +
        target.low.toFixed(1) + '–' + target.high.toFixed(1) + '</strong><small>最近测试：' +
        (scores[target.module] == null ? '暂无' : scores[target.module].toFixed(1)) + '</small></article>'
    }).join('') + '<p class="ielts-caption">按听读较高、写说稳步达标的策略分配；范围下限组合平均为 ' +
      (ranges.reduce(function (sum, target) { return sum + target.low }, 0) / 4).toFixed(1) +
      '。这是备考目标，不是成绩预测；写作、口语尚无测试数据。<a href="https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail" target="_blank" rel="noopener">总分计分规则</a></p>'
  }

  function dateKey(date) { return date.toISOString().slice(0, 10) }

  function dailyMinutes() {
    return state.records.reduce(function (days, record) {
      days[record.date] = (days[record.date] || 0) + Math.max(0, numberOrZero(record.minutes))
      return days
    }, {})
  }

  function heatLevel(minutes) {
    return minutes >= 120 ? 4 : minutes >= 60 ? 3 : minutes >= 30 ? 2 : minutes > 0 ? 1 : 0
  }

  function setupCalendar() {
    var currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()))
    var years = Array.from(new Set([currentYear].concat(state.records.map(function (r) { return Number(r.date.slice(0, 4)) })))).sort(function (a, b) { return b - a })
    var select = document.querySelector('.ielts-year')
    select.innerHTML = years.map(function (year) { return '<option>' + year + '</option>' }).join('')
    select.value = String(currentYear)
    select.addEventListener('change', renderCalendar)
  }

  function renderCalendar() {
    var year = Number(document.querySelector('.ielts-year').value)
    var totals = dailyMinutes(), minutes = 0, days = 0
    var weekdays = ['一', '二', '三', '四', '五', '六', '日']
    var html = ''
    for (var month = 0; month < 12; month++) {
      html += '<section class="ielts-month"><h4>' + (month + 1) + '月</h4><div class="ielts-month-grid">'
      html += weekdays.map(function (day) { return '<span class="ielts-weekday">' + day + '</span>' }).join('')
      var offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
      for (var blank = 0; blank < offset; blank++) html += '<span></span>'
      var count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      for (var day = 1; day <= count; day++) {
        var key = dateKey(new Date(Date.UTC(year, month, day)))
        var value = totals[key] || 0
        minutes += value
        if (value > 0) days++
        var label = key + '：' + (value > 0 ? formatMinutes(value) : '未记录学习时长')
        html += '<span class="ielts-heat-day" tabindex="0" data-date="' + key + '" data-level="' +
          heatLevel(value) + '" data-tooltip="' + label + '" aria-label="' + label + '">' + day + '</span>'
      }
      html += '</div></section>'
    }
    document.querySelector('[data-calendar]').innerHTML = html
    document.querySelector('[data-calendar-summary]').textContent = year + ' 年 · ' + days + ' 个学习日 · ' + formatMinutes(minutes)
  }

  function debounce(fn, wait) {
    var timer
    return function () {
      clearTimeout(timer)
      timer = setTimeout(fn, wait)
    }
  }

  window.addEventListener('resize', debounce(drawChart, 160))
  window.addEventListener('load', mount)
  if (document.readyState !== 'loading') mount()
  document.addEventListener('pjax:complete', mount)
  document.addEventListener('shuoshuo:rendered', mount)
  new MutationObserver(function () {
    if (isTrackerPage() && !document.querySelector('.ielts-tracker')) mount()
  }).observe(document.documentElement, { childList: true, subtree: true })
})()
