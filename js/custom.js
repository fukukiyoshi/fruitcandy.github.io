(function () {
  var playerState = {
    initialized: false,
    audio: null,
    playlist: [],
    index: 0,
    manuallyPaused: false,
    restored: false
  }

  var musicStorageKey = 'fruitcandy-music-state'

  function isHomePage() {
    var path = window.location.pathname.replace(/\/+$/, '/')
    return path === '/' || path === '/index.html'
  }

  function hasPageMusicComponent() {
    var page = document.querySelector('#article-container')
    if (!page) return false

    return Boolean(page.querySelector('.aplayer, .meting-js, audio, iframe[src*="music"], iframe[src*="player"]'))
  }

  function addVisitorCard() {
    if (!isHomePage() || document.querySelector('.home-visitor-card')) return

    var recentPosts = document.querySelector('#recent-posts')
    if (!recentPosts) return

    var card = document.createElement('div')
    card.className = 'home-visitor-card'
    card.innerHTML = '你是造访水果糖的世界的第 <span class="visitor-number">...</span> 名旅客'
    card.title = '如果这里长时间停在省略号，通常是浏览器或网络没有加载到不蒜子统计脚本。'
    recentPosts.appendChild(card)

    var number = card.querySelector('.visitor-number')
    var attempts = 0
    var timer = window.setInterval(function () {
      var source = document.querySelector('#busuanzi_value_site_uv')
      var text = source && source.textContent && source.textContent.trim()
      if (text && text !== '...') {
        number.textContent = text
        window.clearInterval(timer)
      } else if (++attempts >= 24) {
        number.textContent = '统计加载中'
        window.clearInterval(timer)
      }
    }, 500)
  }

  function updateMusicButton(isPlaying) {
    var buttonIcon = document.querySelector('.candy-music-toggle i')
    if (!buttonIcon) return
    buttonIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-music'
  }

  function setMusicTrack(track) {
    if (!track || !playerState.audio) return
    playerState.audio.src = track.src

    var title = document.querySelector('.candy-music-title')
    var artist = document.querySelector('.candy-music-artist')
    if (title) title.textContent = track.title || '未命名音乐'
    if (artist) artist.textContent = track.artist || ''
  }

  function saveMusicState() {
    if (!playerState.audio) return

    try {
      sessionStorage.setItem(musicStorageKey, JSON.stringify({
        index: playerState.index,
        currentTime: playerState.audio.currentTime || 0,
        manuallyPaused: playerState.manuallyPaused,
        wasPlaying: !playerState.audio.paused
      }))
    } catch (error) {}
  }

  function restoreMusicState() {
    if (playerState.restored || !playerState.audio) return
    playerState.restored = true

    try {
      var raw = sessionStorage.getItem(musicStorageKey)
      if (!raw) return

      var state = JSON.parse(raw)
      if (Number.isInteger(state.index) && state.index >= 0 && state.index < playerState.playlist.length) {
        playerState.index = state.index
        setMusicTrack(playerState.playlist[playerState.index])
      }

      playerState.manuallyPaused = Boolean(state.manuallyPaused)
      if (Number.isFinite(state.currentTime) && state.currentTime > 0) {
        playerState.audio.currentTime = state.currentTime
      }
    } catch (error) {}
  }

  function tryPlayMusic() {
    if (!playerState.audio || playerState.manuallyPaused || hasPageMusicComponent()) return

    var playPromise = playerState.audio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise
        .then(function () { updateMusicButton(true) })
        .catch(function () { updateMusicButton(false) })
    } else {
      updateMusicButton(true)
    }
  }

  function bindDeferredAutoplay() {
    var resume = function () {
      tryPlayMusic()
      document.removeEventListener('click', resume)
      document.removeEventListener('scroll', resume)
      document.removeEventListener('keydown', resume)
      document.removeEventListener('touchstart', resume)
    }

    document.addEventListener('click', resume, { once: true })
    document.addEventListener('scroll', resume, { once: true })
    document.addEventListener('keydown', resume, { once: true })
    document.addEventListener('touchstart', resume, { once: true })
  }

  function addMusicPlayer() {
    if (playerState.initialized) {
      var existingPlayer = document.querySelector('.candy-music-player')
      if (existingPlayer) existingPlayer.hidden = hasPageMusicComponent()
      if (hasPageMusicComponent() && playerState.audio) {
        playerState.audio.pause()
        updateMusicButton(false)
        return
      }
      tryPlayMusic()
      return
    }

    playerState.initialized = true

    fetch('/music/playlist.json')
      .then(function (response) {
        if (!response.ok) throw new Error('playlist not found')
        return response.json()
      })
      .then(function (playlist) {
        if (!Array.isArray(playlist) || !playlist.length) return

        playerState.playlist = playlist
        playerState.audio = new Audio()
        playerState.audio.preload = 'auto'
        playerState.audio.loop = playlist.length === 1

        var player = document.createElement('aside')
        player.className = 'candy-music-player'
        player.innerHTML = [
          '<button class="candy-music-toggle" type="button" title="播放 / 暂停音乐"><i class="fa-solid fa-music"></i></button>',
          '<div class="candy-music-info">',
          '<div class="candy-music-title"></div>',
          '<div class="candy-music-artist"></div>',
          '</div>'
        ].join('')
        document.body.appendChild(player)

        setMusicTrack(playlist[0])
        restoreMusicState()
        player.hidden = hasPageMusicComponent()

        player.querySelector('.candy-music-toggle').addEventListener('click', function () {
          player.classList.add('is-expanded')
          if (playerState.audio.paused) {
            playerState.manuallyPaused = false
            playerState.audio.play()
            updateMusicButton(true)
          } else {
            playerState.manuallyPaused = true
            playerState.audio.pause()
            updateMusicButton(false)
          }
        })

        player.addEventListener('mouseenter', function () {
          player.classList.add('is-expanded')
        })

        player.addEventListener('mouseleave', function () {
          if (!playerState.audio.paused) player.classList.remove('is-expanded')
        })

        playerState.audio.addEventListener('ended', function () {
          if (playerState.playlist.length <= 1) return
          playerState.index = (playerState.index + 1) % playerState.playlist.length
          setMusicTrack(playerState.playlist[playerState.index])
          tryPlayMusic()
        })

        playerState.audio.addEventListener('play', function () { updateMusicButton(true) })
        playerState.audio.addEventListener('pause', function () { updateMusicButton(false) })
        playerState.audio.addEventListener('timeupdate', saveMusicState)
        window.addEventListener('beforeunload', saveMusicState)

        if (!hasPageMusicComponent()) tryPlayMusic()
        bindDeferredAutoplay()
      })
      .catch(function (error) {
        console.warn('[fruitcandy music]', error)
      })
  }

  window.addEventListener('load', addVisitorCard)
  window.addEventListener('load', addMusicPlayer)
  document.addEventListener('pjax:complete', addVisitorCard)
  document.addEventListener('pjax:complete', addMusicPlayer)
})()
