/* Model landmarks in glTF coordinates (+Z faces the camera).
   MindAR landmarks are in metric face space; the anchor already applies faceScale. */
(function (root) {
 const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
 function fitMask(estimate) {
  if (!estimate || !Number.isFinite(estimate.faceScale) || estimate.faceScale <= 0) return null;
  const points = estimate.metricLandmarks;
  if (![168, 4, 33, 133, 263, 362, 152].every(i => points?.[i]?.length === 3 && points[i].every(Number.isFinite))) return null;
  const origin = points[168];
  const local = i => points[i].map((v, k) => (v - origin[k]) / estimate.faceScale);
  const avg = (a, b) => a.map((v, k) => (v + b[k]) / 2);
  const left = avg(local(33), local(133)), right = avg(local(263), local(362));
  const eyes = avg(left, right), nose = local(4), chin = local(152);
  const sx = clamp(Math.abs(right[0] - left[0]) / 0.86, 0.32, 0.65);
  const sy = clamp((eyes[1] - chin[1]) / 1.69, 0.32, 0.70);
  const sz = clamp((nose[2] - eyes[2]) / (0.910237 - 0.306001), 0.20, 0.65);
  return {scale: [sx, sy, sz], position: [eyes[0], eyes[1] - 0.39 * sy, eyes[2] - 0.306001 * sz + 0.018]};
 }
 root.fitMask = fitMask;
 if (!root.AFRAME) return;
 AFRAME.registerComponent('mask-fit', {
  init() { this.reset(); },
  reset() { this.samples = []; this.fit = null; this.currentFit = null; this.lastEstimate = null; },
  tick() {
   if (this.fit) return;
   const estimate = this.el.sceneEl.systems['mindar-face-system']?.controller?.lastEstimateResult;
   if (!estimate) { this.samples = []; this.lastEstimate = null; return; }
   if (estimate === this.lastEstimate) return;
   this.lastEstimate = estimate;
   const fit = fitMask(estimate);
   if (!fit) return;
   this.samples.push(fit);
   // Show a correctly placed mask immediately, then lock the median fit.
   // Shape fitting stops after calibration; head pose remains live in MindAR.
   const median = values => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
   this.currentFit = {
    scale: [0,1,2].map(k => median(this.samples.map(s => s.scale[k]))),
    position: [0,1,2].map(k => median(this.samples.map(s => s.position[k])))
   };
   this.apply();
   if (this.samples.length >= 20) {
    this.fit = this.currentFit;
    this.el.sceneEl.emit('maskFitted');
   }
  },
  apply() {
   const fit = this.fit || this.currentFit;
   if (!fit) return;
   const size = Number(document.querySelector('#size').value);
   const height = Number(document.querySelector('#height').value);
   const depth = Number(document.querySelector('#depth').value);
   this.el.object3D.scale.set(...fit.scale.map(v => v * size));
   // Keep the eye plane in place when changing size.
   this.el.object3D.position.set(fit.position[0], fit.position[1] + 0.39 * fit.scale[1] * (1-size) + height,
    fit.position[2] + 0.306001 * fit.scale[2] * (1-size) + depth);
  }
 });
})(globalThis);
