const scene = document.querySelector('a-scene');
const mask = document.querySelector('#mask');
const start = document.querySelector('#start');
const intro = document.querySelector('#intro');
const panel = document.querySelector('#panel');
const status = document.querySelector('#status');
let running = false;
let runtimeInstalled = false;
function ready() { start.disabled = false; start.textContent = 'Включить камеру'; }
mask.addEventListener('model-loaded', ready);
if (mask.getObject3D?.('mesh')) ready();
mask.addEventListener('model-error', () => { document.querySelector('#hint').textContent = 'Не удалось загрузить маску. Запустите страницу через локальный сервер и обновите её.'; });
start.onclick = () => {
 if (!window.isSecureContext || !navigator.mediaDevices) {
  document.querySelector('#hint').textContent = 'Для камеры откройте страницу через HTTPS или localhost.'; return;
 }
 start.disabled = true; start.textContent = 'Запуск камеры…';
 mask.components['mask-fit'].reset();
 const system = scene.systems['mindar-face-system'];
 if (!runtimeInstalled) {
  installTrackingRuntime(system, (state) => {
   const messages = {loading:'Загрузка распознавания…',searching:'Поиск лица…',fallback:'Пробуем совместимый режим распознавания…','no-face':'Распознавание работает, но лица не видно. Смотрите прямо, приблизьтесь к камере и осветите лицо.'};
   if (state === 'loading') start.textContent = messages[state];
   else status.textContent = messages[state];
  }, (error) => {
   console.error('Face tracking failed', error);
   document.querySelector('#hint').textContent = error.name === 'NotAllowedError' ? 'Разрешите доступ к камере в настройках браузера.' : (error.message || 'Не удалось запустить распознавание. Повторите запуск.');
   shutdown();
  });
  runtimeInstalled = true;
 }
 system.start();
};
scene.addEventListener('arReady', () => {
 running = true; intro.hidden = true; panel.hidden = false; status.textContent = 'Поиск лица…';
});
scene.addEventListener('arError', () => {
 document.querySelector('#hint').textContent = 'Камера недоступна. Проверьте разрешение браузера и закройте другие приложения с камерой.';
 shutdown();
});
scene.addEventListener('targetFound', () => {status.textContent = mask.components['mask-fit'].fit ? 'Маска подогнана к лицу' : 'Смотрите прямо — подгоняем маску…';});
scene.addEventListener('targetLost', () => {status.textContent = 'Лицо потеряно — повернитесь к камере';});
function shutdown() {
 const system = scene.systems['mindar-face-system'];
 if (runtimeInstalled) system.stop();
 running = false; panel.hidden = true; intro.hidden = false; ready();
}
document.querySelector('#stop').onclick = shutdown;
window.addEventListener('pagehide', () => { if (runtimeInstalled) shutdown(); });
for (const id of ['size', 'height', 'depth']) {
 document.getElementById(id).oninput = (event) => {
  document.getElementById(id + 'Out').value = event.target.value;
  mask.components['mask-fit'].apply();
 };
}
setTimeout(() => {
 if (!window.AFRAME || !scene.systems?.['mindar-face-system']) document.querySelector('#hint').textContent = 'Не удалось загрузить библиотеки. Проверьте подключение к интернету и обновите страницу.';
}, 15000);

scene.addEventListener('maskFitted', () => { status.textContent = 'Маска подогнана к лицу'; });
document.querySelector('#refit').onclick = () => {
 for (const [id,value] of [['size',1],['height',0],['depth',0]]) { document.getElementById(id).value = value; document.getElementById(id+'Out').value = value; }
 mask.components['mask-fit'].reset();
 status.textContent = 'Смотрите прямо — подгоняем маску…';
};
