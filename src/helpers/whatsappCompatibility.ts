/** Compatibilidade com sessões cujo UserPrefs expõe apenas o getter opcional de LID. */
export function patchLidUserPrefs(prefs: Record<string, any>) {
 if (typeof prefs.getMeLidUserOrThrow === 'function') return false;
 if (typeof prefs.getMaybeMeLidUser !== 'function' && typeof prefs.getMaybeMeLid !== 'function') {
  throw new Error('WhatsApp incompatível: getter de LID indisponível.');
 }
 Object.defineProperty(prefs, 'getMeLidUserOrThrow', {
  configurable: true, writable: true,
  value: function () {
   const lid = typeof prefs.getMaybeMeLidUser === 'function' ? prefs.getMaybeMeLidUser() : prefs.getMaybeMeLid();
   if (!lid) throw new Error('WhatsApp ainda não disponibilizou o LID da sessão.');
   return lid;
  },
 });
 return true;
}

export async function installWhatsAppCompatibility(client: { page: { evaluate: (script: string) => Promise<unknown> } }) {
 await client.page.evaluate(`(${patchLidUserPrefs.toString()})(WPP.whatsapp.UserPrefs)`);
}
