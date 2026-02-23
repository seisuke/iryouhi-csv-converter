import './drop-zone';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  const zone = document.createElement('drop-zone');
  app.appendChild(zone);
}
