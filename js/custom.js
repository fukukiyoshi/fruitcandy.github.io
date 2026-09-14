(function () {
  function isHomePage() {
    var path = window.location.pathname.replace(/\/+$/, '/')
    return path === '/' || path === '/index.html' || path === '/fruitcandy.github.io/'
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

  window.addEventListener('load', addVisitorCard)
  document.addEventListener('pjax:complete', addVisitorCard)
})()
