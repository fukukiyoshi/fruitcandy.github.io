(function () {
  'use strict'

  var apiBase = window.ASKBOX_API_URL || '/api/askbox'
  var secretKey = 'fruitcandy-askbox-secrets'
  var adminKey = 'fruitcandy-askbox-admin'
  var pageSize = 20
  var prompts = [
    ['关于你', '你身上有什么特质，是后来才学会喜欢的？'],
    ['关于你', '你有没有一个从不向别人展示的自己？'],
    ['关于选择', '你做过最正确、却也最痛苦的决定是什么？'],
    ['关于选择', '如果没有任何人会失望，你会选择怎样生活？'],
    ['关于关系', '你认为失望积累到什么程度，人就该离开？'],
    ['关于关系', '有没有一个已经原谅，却始终无法再信任的人？'],
    ['关于脆弱', '你最近一次假装没事，是什么时候？'],
    ['关于脆弱', '你会向别人承认自己嫉妒吗？'],
    ['关于人生', '如果努力最终没有结果，努力本身还值得吗？'],
    ['关于人生', '你觉得人是在什么时候真正长大的？'],
    ['未说出口', '有没有一句迟到很多年、你仍然想说的话？'],
    ['未说出口', '你最希望被谁真正理解一次？'],
    ['遗憾', '如果可以重来，你最想阻止自己做什么？'],
    ['遗憾', '有什么失去，是你至今不敢认真回想的？'],
    ['爱与孤独', '你更害怕不被爱，还是被爱以后失去？'],
    ['爱与孤独', '一个人要怎样确认，自己是真的爱上了另一个人？']
  ]

  function create(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
  }

  function addHomeEntry() {
    var path = window.location.pathname.replace(/\/+$/, '/')
    var posts = document.querySelector('#recent-posts')
    if ((path !== '/' && path !== '/index.html') || !posts || document.querySelector('.askbox-home-entry')) return

    var link = create('a', 'askbox-home-entry')
    link.href = '/ask/'
    link.appendChild(create('strong', '', '匿名提问箱'))
    link.appendChild(create('span', '', '所有人可以旁听，但每段对话永远只有两个人。'))
    posts.insertBefore(link, posts.firstChild)
  }

  function getSecrets() {
    try { return JSON.parse(localStorage.getItem(secretKey) || '{}') } catch (error) { return {} }
  }

  function saveSecret(id, secret) {
    var secrets = getSecrets()
    secrets[id] = secret
    localStorage.setItem(secretKey, JSON.stringify(secrets))
  }

  function adminToken() {
    return sessionStorage.getItem(adminKey) || ''
  }

  function request(path, options) {
    options = options || {}
    options.headers = options.headers || {}
    if (adminToken()) options.headers.Authorization = 'Bearer ' + adminToken()
    return fetch(apiBase + path, options).then(async function (response) {
      var data = await response.json().catch(function () { return {} })
      if (!response.ok) throw new Error(data.error || '请求失败，请稍后再试。')
      return data
    })
  }

  function formatDate(value) {
    var date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date)
  }

  function avatar(url, name, small) {
    var node = create('div', small ? 'askbox-message-avatar' : 'askbox-letter-avatar')
    if (url) {
      node.style.backgroundImage = 'url("' + encodeURI(url).replace(/"/g, '%22') + '")'
      node.style.backgroundPosition = 'center'
      node.style.backgroundSize = 'cover'
    } else {
      node.textContent = String(name || '?').slice(0, 1)
      node.style.display = 'grid'
      node.style.placeItems = 'center'
      node.style.color = 'var(--ask-accent)'
      node.style.fontWeight = '800'
    }
    return node
  }

  function setPrompt(prompt) {
    var textarea = document.querySelector('#askbox-question')
    if (!textarea) return
    textarea.value = prompt[1]
    textarea.focus()
    document.querySelector('#askbox-compose').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function renderPrompts(container) {
    container.textContent = ''
    prompts.forEach(function (prompt) {
      var button = create('button', 'askbox-prompt')
      button.type = 'button'
      button.appendChild(create('small', '', prompt[0]))
      button.appendChild(document.createTextNode(prompt[1]))
      button.addEventListener('click', function () { setPrompt(prompt) })
      container.appendChild(button)
    })
  }

  function compressAvatar(file) {
    if (!file) return Promise.resolve(null)
    if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error('头像原图不能超过 8MB。'))

    return createImageBitmap(file).then(function (bitmap) {
      var size = Math.min(bitmap.width, bitmap.height)
      var sx = Math.floor((bitmap.width - size) / 2)
      var sy = Math.floor((bitmap.height - size) / 2)
      var canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      canvas.getContext('2d').drawImage(bitmap, sx, sy, size, size, 0, 0, 512, 512)
      bitmap.close()
      return new Promise(function (resolve) {
        canvas.toBlob(resolve, 'image/webp', .84)
      })
    })
  }

  function messageNode(message, conversation, ownerName) {
    var isOwner = message.role === 'owner'
    var row = create('div', 'askbox-message' + (isOwner ? ' is-owner' : ''))
    row.appendChild(avatar(isOwner ? '/img/fruitcandy.jpg' : conversation.avatarUrl, isOwner ? ownerName : conversation.nickname, true))

    var bubble = create('div', 'askbox-message-body')
    bubble.appendChild(create('p', '', message.body))
    var meta = create('div', 'askbox-message-meta')
    meta.appendChild(create('strong', '', isOwner ? ownerName : conversation.nickname))
    meta.appendChild(document.createTextNode(formatDate(message.createdAt)))
    bubble.appendChild(meta)
    row.appendChild(bubble)
    return row
  }

  function renderReplyArea(conversation, reload) {
    var area = create('div', 'askbox-reply-area')
    var secret = getSecrets()[conversation.id]
    var isAdmin = Boolean(adminToken())
    if (!secret && !isAdmin) {
      area.appendChild(create('p', 'askbox-readonly-note', '旁听模式 · 只有来信者和站主可以继续对话'))
      return area
    }

    var form = create('form', 'askbox-reply-form')
    var textarea = create('textarea')
    textarea.required = true
    textarea.maxLength = 2000
    textarea.placeholder = isAdmin ? '回复 TA……' : '继续这段对话……'
    var button = create('button', 'askbox-button askbox-button-primary', isAdmin ? '回复' : '继续说')
    button.type = 'submit'
    form.appendChild(textarea)
    form.appendChild(button)
    form.addEventListener('submit', function (event) {
      event.preventDefault()
      button.disabled = true
      request('/conversations/' + encodeURIComponent(conversation.id) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: textarea.value, secret: secret || undefined })
      }).then(function () {
        textarea.value = ''
        return reload()
      }).catch(function (error) {
        window.alert(error.message)
      }).finally(function () {
        button.disabled = false
      })
    })
    area.appendChild(form)
    return area
  }

  function conversationNode(conversation, ownerName, reload) {
    var card = create('article', 'askbox-letter')
    card.id = 'letter-' + conversation.id
    var head = create('div', 'askbox-letter-head')
    head.appendChild(avatar(conversation.avatarUrl, conversation.nickname))
    var who = create('div', 'askbox-letter-who')
    who.appendChild(create('strong', '', conversation.nickname))
    var time = create('time', '', formatDate(conversation.createdAt))
    time.dateTime = conversation.createdAt
    who.appendChild(time)
    head.appendChild(who)
    head.appendChild(create('span', 'askbox-status', conversation.status === 'answered' ? '对话中' : '等待回答'))
    card.appendChild(head)

    var thread = create('div', 'askbox-thread')
    conversation.messages.forEach(function (message) {
      thread.appendChild(messageNode(message, conversation, ownerName))
    })
    card.appendChild(thread)
    card.appendChild(renderReplyArea(conversation, reload))
    return card
  }

  function initApp(app) {
    if (app.dataset.initialized) return
    app.dataset.initialized = 'true'

    if (window.location.hash.indexOf('#recover=') === 0) {
      var recovery = decodeURIComponent(window.location.hash.slice(9))
      var separator = recovery.indexOf('.')
      if (separator > 0) {
        var recoveredId = recovery.slice(0, separator)
        saveSecret(recoveredId, recovery.slice(separator + 1))
        history.replaceState(null, '', window.location.pathname + '#letter-' + recoveredId)
      }
    }

    var list = document.querySelector('#askbox-list')
    var more = document.querySelector('#askbox-more')
    var form = document.querySelector('#askbox-form')
    var formStatus = document.querySelector('#askbox-form-status')
    var avatarInput = document.querySelector('#askbox-avatar')
    var avatarPreview = document.querySelector('#askbox-avatar-preview')
    var promptPanel = document.querySelector('#askbox-prompts')
    var offset = 0
    var ownerName = '水果糖'

    renderPrompts(promptPanel)

    document.querySelector('#askbox-prompts-toggle').addEventListener('click', function () {
      promptPanel.hidden = !promptPanel.hidden
    })
    document.querySelector('#askbox-random').addEventListener('click', function () {
      setPrompt(prompts[Math.floor(Math.random() * prompts.length)])
    })
    avatarInput.addEventListener('change', function () {
      var file = avatarInput.files && avatarInput.files[0]
      if (!file) return
      avatarPreview.style.backgroundImage = 'url("' + URL.createObjectURL(file) + '")'
      avatarPreview.classList.add('has-image')
    })

    function load(reset) {
      if (reset) {
        offset = 0
        list.innerHTML = '<div class="askbox-loading">正在拆信……</div>'
      }
      return request('/conversations?limit=' + pageSize + '&offset=' + offset).then(function (data) {
        ownerName = data.ownerName || ownerName
        if (reset) list.textContent = ''
        if (!data.items.length && !offset) list.appendChild(create('div', 'askbox-empty', '还没有来信。你可以成为第一个开口的人。'))
        data.items.forEach(function (conversation) {
          list.appendChild(conversationNode(conversation, ownerName, function () { return load(true) }))
        })
        offset += data.items.length
        more.hidden = !data.hasMore

        if (window.location.hash) {
          var target = document.querySelector(window.location.hash)
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }).catch(function (error) {
        list.textContent = ''
        list.appendChild(create('div', 'askbox-empty', error.message))
      })
    }

    more.addEventListener('click', function () { load(false) })

    document.querySelector('#askbox-admin').addEventListener('click', function () {
      var token = window.prompt('输入站主口令。留空会退出站主模式。', adminToken())
      if (token == null) return
      if (token.trim()) sessionStorage.setItem(adminKey, token.trim())
      else sessionStorage.removeItem(adminKey)
      load(true)
    })

    form.addEventListener('submit', function (event) {
      event.preventDefault()
      var submit = form.querySelector('[type="submit"]')
      submit.disabled = true
      formStatus.textContent = '正在寄出……'

      compressAvatar(avatarInput.files && avatarInput.files[0]).then(function (blob) {
        var data = new FormData(form)
        data.delete('avatar')
        if (blob) data.append('avatar', blob, 'avatar.webp')
        return request('/conversations', { method: 'POST', body: data })
      }).then(function (result) {
        saveSecret(result.id, result.secret)
        form.reset()
        avatarPreview.style.backgroundImage = ''
        avatarPreview.classList.remove('has-image')
        formStatus.textContent = '已经公开寄出。只有这个浏览器和你的邮件恢复链接能继续对话。'
        window.location.hash = 'letter-' + result.id
        return load(true)
      }).catch(function (error) {
        formStatus.textContent = error.message
      }).finally(function () {
        submit.disabled = false
      })
    })

    load(true)
  }

  function init() {
    addHomeEntry()
    var app = document.querySelector('#askbox-app')
    if (app) initApp(app)
  }

  document.addEventListener('DOMContentLoaded', init)
  document.addEventListener('pjax:complete', init)
  if (document.readyState !== 'loading') init()
})()
