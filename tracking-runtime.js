/* Adapter for the pinned MindAR 1.2.5 A-Frame runtime. */
(function (root) {
 function installTrackingRuntime(system, onState, onFailure) {
  let releaseDetector = null;
  let generation = 0, watchdog = null, lastFrameAt = 0, startingAt = 0;
  const originalSetup = system._setupAR.bind(system);
  const originalStop = system.stop.bind(system);
  const empty = () => ({faceLandmarks: [], faceBlendshapes: []});
  const fail = (error, token) => { if (token === generation) onFailure(error); };
  system._startVideo = async function () {
   const token = ++generation;
   startingAt = performance.now(); lastFrameAt = 0;
   this.lastHasFace = false;
   const video = document.createElement('video');
   this.video = video;
   video.autoplay = true; video.muted = true; video.playsInline = true;
   video.setAttribute('playsinline', '');
   video.style.cssText = 'position:absolute;top:0;left:0;z-index:-2';
   this.container.appendChild(video);
   clearInterval(watchdog);
   watchdog = setInterval(() => {
    if (document.hidden) return;
    const elapsed = performance.now() - (lastFrameAt || startingAt);
    if (elapsed > (lastFrameAt ? 12000 : 45000)) fail(new Error(lastFrameAt ? 'Распознавание перестало получать кадры. Перезапустите камеру.' : 'Распознавание не запустилось. Проверьте интернет и повторите запуск.'), token);
   }, 1000);
   try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
    if (token !== generation) { stream.getTracks().forEach(t=>t.stop()); return; }
    video.srcObject = stream;
    await video.play();
    if (token !== generation) return;
    video.setAttribute('width', video.videoWidth); video.setAttribute('height', video.videoHeight);
    onState('loading');
    await originalSetup();
    if (token !== generation) { this.controller?.faceMeshHelper?.faceLandmarker?.close(); return; }
    const helper = this.controller.faceMeshHelper;
    const detector = helper.faceLandmarker;
    await detector.setOptions({runningMode:'VIDEO',minFaceDetectionConfidence:0.4,minFacePresenceConfidence:0.4,minTrackingConfidence:0.4});
    if (token !== generation) { detector.close(); return; }
    let busy = false, closed = false;
    const release = () => { if (!busy && !closed) { closed = true; detector.close(); } };
    releaseDetector = release;
    let cpu = false, lastFaceAt = performance.now(), guidanceShown = false;
    async function useCPU() {
     cpu = true;
     onState('fallback');
     await detector.setOptions({baseOptions:{delegate:'CPU'}});
    }
    helper.detect = async input => {
     if (token !== generation) return empty();
     busy = true;
     try {
      let result;
      try { result = detector.detectForVideo(input, performance.now()); }
      catch (error) {
       if (cpu) throw error;
       await useCPU();
       if (token !== generation) return empty();
       result = detector.detectForVideo(input, performance.now());
      }
      lastFrameAt = performance.now();
      if (result.faceLandmarks.length) { lastFaceAt = lastFrameAt; guidanceShown = false; }
      else if (lastFrameAt - lastFaceAt > 5000 && !cpu) {
       await useCPU();
       if (token !== generation) return empty();
       lastFaceAt = performance.now();
      } else if (lastFrameAt - lastFaceAt > 5000 && !guidanceShown) {
       guidanceShown = true; onState('no-face');
      }
      return result;
     } catch (error) {
      fail(new Error('Ошибка распознавания лица. Перезапустите камеру или откройте страницу в другом браузере.', {cause:error}), token);
      return empty();
     } finally { busy = false; if (token !== generation) release(); }
    };
    onState('searching');
    this._processVideo();
    this.ui.hideLoading();
   } catch (error) { fail(error, token); }
  };
  system.stop = function () {
   ++generation; clearInterval(watchdog);
   releaseDetector?.(); releaseDetector = null;
   if (this.controller && this.video?.srcObject) originalStop();
   else { this.video?.srcObject?.getTracks().forEach(t=>t.stop()); this.video?.remove(); }
   this.anchorEntities.forEach(a=>a.el.updateVisibility(false));
   this.lastHasFace = false;
  };
 }
 root.installTrackingRuntime = installTrackingRuntime;
})(globalThis);
