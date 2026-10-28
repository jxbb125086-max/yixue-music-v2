// compositor-web-shim.js
// 网页版 compositor shim，让 renderer/app.js 无需修改即可在浏览器运行
// 替换 Electron 专属功能为浏览器可用方案

(function() {
  if (window.__compositorWebShimInstalled) return;
  window.__compositorWebShimInstalled = true;

  window.compositor = {
    // ── 屏幕/窗口共享（替代 desktopCapturer）──
    // 网页版无法枚举系统窗口，统一走 getDisplayMedia（浏览器屏幕共享）
    async listSources() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return [{ id: 'web-share', type: 'webShare', name: '（当前浏览器不支持屏幕共享）', isScreen: true, unsupported: true }];
      }
      return [{ id: 'web-share', type: 'webShare', name: '共享屏幕 / 窗口', isScreen: true }];
    },

    // ── 文件选择（替代 dialog.openFile）──
    async openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        // 一次只加一个文件（app.js 每次点击只建一个框，允许多选会让人以为能一次加多个）
        input.multiple = false;
        input.accept = 'image/*,video/*,audio/*,.pdf';
        input.onchange = () => {
          const files = Array.from(input.files);
          if (files.length === 0) {
            resolve(null);
            return;
          }
          resolve(files.map(f => ({
            name: f.name,
            url: URL.createObjectURL(f),
            type: f.type
          })));
        };
        input.click();
      });
    },

    // ── 窗口控制（浏览器不支持，降级处理）──
    relaunch() {
      location.reload();
    },

    log(msg) {
      console.log('[compositor]', msg);
    }
  };

  console.log('[shim] compositor-web-shim 已加载');
})();
