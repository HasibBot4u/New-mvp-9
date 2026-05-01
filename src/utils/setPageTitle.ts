export function setPageTitle(title: string, suffix = 'NexusEdu') {
  document.title = suffix ? `${title} — ${suffix}` : title;
}
