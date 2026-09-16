(function () {
  'use strict'

  var STORAGE_KEY = 'ielts-tracker:e2263ef0-b8a0-4684-b273-3a6d33dd1836:v1'
  var MODULES = ['听力', '阅读', '写作', '口语']
  var state = { goal: 7, records: [] }

  function isTrackerPage() {
    return /^\/shuoshuo(?:\/|\/index\.html)?$/.test(window.location.pathname)
  }

  function today() {
    var date = new Date()
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().slice(0, 10)
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  function loadLocalState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (saved && Array.isArray(saved.records)) {
        state.goal = Number(saved.goal) || 7
        state.records = saved.records
      }
    } catch (error) {
      console.warn('[IELTS tracker] 无法读取本地记录', error)
    }
  }

  function loadState() {
    loadLocalState()
    return fetch('/data/ielts-records.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
      .then(function (published) {
        if (!published || !Array.isArray(published.records)) return
        var merged = new Map()
        published.records.forEach(function (record) { merged.set(record.id, record) })
        state.records.forEach(function (record) { merged.set(record.id, record) })
        state.records = Array.from(merged.values())
        if (!localStorage.getItem(STORAGE_KEY) && Number(published.goal)) {
          state.goal = Number(published.goal)
        }
      })
      .catch(function (error) {
        console.warn('[IELTS tracker] 无法读取公开记录，继续使用本地记录', error)
      })
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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
      '    <button class="ielts-add-button" type="button" data-action="open-form"><i class="fa-solid fa-plus"></i> 记录今天</button>',
      '  </header>',
      '  <div class="ielts-stat-grid">',
      '    <article class="ielts-stat ielts-goal-card"><span>目标分数</span><strong data-stat="goal">7.0</strong><button type="button" data-action="edit-goal" aria-label="修改目标分数"><i class="fa-solid fa-pen"></i></button></article>',
      '    <article class="ielts-stat"><span>最近测试</span><strong data-stat="latest">—</strong><small data-stat="latest-module">还没有分数记录</small></article>',
      '    <article class="ielts-stat"><span>累计学习</span><strong data-stat="minutes">0 分钟</strong><small data-stat="days">0 个学习日</small></article>',
      '    <article class="ielts-stat"><span>单词 / 套题</span><strong data-stat="practice">0 / 0</strong><small>累计完成</small></article>',
      '  </div>',
      '  <div class="ielts-panel ielts-chart-panel">',
      '    <div class="ielts-panel-heading"><div><span>成长轨迹</span><h3>模考分数趋势</h3></div><div class="ielts-legend"></div></div>',
      '    <div class="ielts-chart-wrap"><canvas class="ielts-chart" aria-label="雅思模考分数趋势图"></canvas><div class="ielts-chart-empty">记录一次带分数的练习后，这里会出现成长曲线。</div></div>',
      '  </div>',
      '  <div class="ielts-lower-grid">',
      '    <div class="ielts-panel ielts-advice-panel">',
      '      <div class="ielts-panel-heading"><div><span>AI COACH</span><h3>明日学习建议</h3></div><button type="button" class="ielts-icon-button" data-action="refresh-advice" title="重新生成"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div>',
      '      <div class="ielts-advice" data-advice><p>添加学习记录后，我会根据你的投入与分数变化安排明天的练习。</p></div>',
      '    </div>',
      '    <div class="ielts-panel ielts-record-panel">',
      '      <div class="ielts-panel-heading"><div><span>RECENT LOG</span><h3>最近记录</h3></div><button type="button" class="ielts-text-button" data-action="export">导出数据</button></div>',
      '      <div class="ielts-records" data-records></div>',
      '    </div>',
      '  </div>',
      '  <dialog class="ielts-dialog">',
      '    <form method="dialog" class="ielts-form">',
      '      <div class="ielts-form-heading"><div><span>DAILY CHECK-IN</span><h3>记录今天的学习</h3></div><button type="button" data-action="close-form" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button></div>',
      '      <input type="hidden" name="id">',
      '      <div class="ielts-form-grid">',
      '        <label><span>日期</span><input required type="date" name="date"></label>',
      '        <label><span>学习模块</span><select name="module">' + MODULES.map(function (name) { return '<option>' + name + '</option>' }).join('') + '</select></label>',
      '        <label><span>学习时间（分钟）</span><input min="0" step="5" type="number" name="minutes" placeholder="例如 60"></label>',
      '        <label><span>本次分数（可选）</span><input min="0" max="9" step="0.5" type="number" name="score" placeholder="例如 5.5"></label>',
      '        <label><span>背单词（个）</span><input min="0" type="number" name="words" placeholder="例如 50"></label>',
      '        <label><span>完成套题（套）</span><input min="0" step="0.5" type="number" name="sets" placeholder="例如 1"></label>',
      '        <label class="ielts-form-note"><span>学习备注</span><textarea name="note" rows="3" maxlength="240" placeholder="今天卡在哪里？有什么新发现？"></textarea></label>',
      '      </div>',
      '      <div class="ielts-form-actions"><button type="button" class="ielts-secondary-button" data-action="close-form">取消</button><button type="submit" class="ielts-primary-button">保存记录</button></div>',
      '    </form>',
      '  </dialog>',
      '</section>'
    ].join('')
  }

  function mount() {
    if (!isTrackerPage() || document.querySelector('.ielts-tracker')) return
    var article = document.querySelector('#article-container')
    if (!article) return
    article.insertAdjacentHTML('beforebegin', createMarkup())
    bindEvents()
    loadState().then(render)
  }

  function bindEvents() {
    var root = document.querySelector('.ielts-tracker')
    var dialog = root.querySelector('.ielts-dialog')
    var form = root.querySelector('.ielts-form')

    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]')
      if (!button) return
      var action = button.dataset.action
      if (action === 'open-form') openForm()
      if (action === 'close-form') dialog.close()
      if (action === 'edit-goal') editGoal()
      if (action === 'delete') deleteRecord(button.dataset.id)
      if (action === 'edit') editRecord(button.dataset.id)
      if (action === 'refresh-advice') renderAdvice(true)
      if (action === 'export') exportData()
    })

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      var data = new FormData(form)
      var id = data.get('id') || uid()
      var old = state.records.find(function (record) { return record.id === id })
      var record = {
        id: id,
        date: data.get('date'),
        module: data.get('module'),
        minutes: numberOrZero(data.get('minutes')),
        score: data.get('score') === '' ? null : numberOrZero(data.get('score')),
        words: numberOrZero(data.get('words')),
        sets: numberOrZero(data.get('sets')),
        note: String(data.get('note') || '').trim(),
        createdAt: old ? old.createdAt : new Date().toISOString()
      }
      state.records = state.records.filter(function (item) { return item.id !== id })
      state.records.push(record)
      saveState()
      dialog.close()
      render()
    })

    window.addEventListener('resize', debounce(drawChart, 160))
  }

  function openForm(record) {
    var form = document.querySelector('.ielts-form')
    form.reset()
    form.elements.id.value = record ? record.id : ''
    form.elements.date.value = record ? record.date : today()
    if (record) {
      ;['module', 'minutes', 'score', 'words', 'sets', 'note'].forEach(function (key) {
        form.elements[key].value = record[key] == null ? '' : record[key]
      })
    }
    var dialog = document.querySelector('.ielts-dialog')
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }

  function editRecord(id) {
    var record = state.records.find(function (item) { return item.id === id })
    if (record) openForm(record)
  }

  function deleteRecord(id) {
    if (!window.confirm('要删除这条学习记录吗？')) return
    state.records = state.records.filter(function (record) { return record.id !== id })
    saveState()
    render()
  }

  function editGoal() {
    var value = window.prompt('你的雅思目标总分是多少？（0–9，支持 0.5 分）', state.goal)
    if (value == null) return
    var goal = Number(value)
    if (!Number.isFinite(goal) || goal < 0 || goal > 9 || goal * 2 % 1 !== 0) {
      window.alert('请输入 0–9 之间、以 0.5 为步长的分数。')
      return
    }
    state.goal = goal
    saveState()
    render()
  }

  function render() {
    renderStats()
    renderRecords()
    requestAnimationFrame(drawChart)
    renderAdvice(false)
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
        '<div class="ielts-log-actions"><button data-action="edit" data-id="' + escapeHtml(record.id) + '" title="编辑"><i class="fa-solid fa-pen"></i></button><button data-action="delete" data-id="' + escapeHtml(record.id) + '" title="删除"><i class="fa-solid fa-trash-can"></i></button></div>' +
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
    ctx.fillText('目标 ' + state.goal.toFixed(1), Math.max(pad.left, width - 74), goalY - 7)

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

  function renderAdvice(forceRemote) {
    var container = document.querySelector('[data-advice]')
    var button = document.querySelector('[data-action="refresh-advice"]')
    var advice = localAdvice()
    container.innerHTML = '<ul>' + advice.map(function (item) { return '<li>' + escapeHtml(item) + '</li>' }).join('') + '</ul><small>根据当前浏览器中的学习记录生成</small>'
    if (!forceRemote || !state.records.length) return
    var endpoint = window.IELTS_TRACKER_API_URL || '/api/ielts-advice'
    button.classList.add('is-loading')
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: state.goal, records: sortedRecords().slice(-30) })
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return response.json()
    }).then(function (result) {
      if (!result.advice) throw new Error('返回内容为空')
      container.innerHTML = '<p>' + escapeHtml(result.advice).replace(/\n/g, '<br>') + '</p><small>由 AI 教练根据最近 30 条记录生成</small>'
    }).catch(function (error) {
      console.warn('[IELTS tracker] AI 建议暂不可用，已保留本地建议', error)
    }).finally(function () { button.classList.remove('is-loading') })
  }

  function exportData() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), goal: state.goal, records: sortedRecords() }, null, 2)], { type: 'application/json' })
    var link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'ielts-study-log-' + today() + '.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function debounce(fn, wait) {
    var timer
    return function () {
      clearTimeout(timer)
      timer = setTimeout(fn, wait)
    }
  }

  window.addEventListener('load', mount)
  document.addEventListener('pjax:complete', mount)
  document.addEventListener('shuoshuo:rendered', mount)
  new MutationObserver(function () {
    if (isTrackerPage() && !document.querySelector('.ielts-tracker')) mount()
  }).observe(document.documentElement, { childList: true, subtree: true })
})()
