import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function acquireRuntimeLock(filename = path.resolve('.runtime/bot.lock')) {
 mkdirSync(path.dirname(filename), { recursive: true });
 for (let attempt = 0; attempt < 2; attempt++) {
  let fd: number;
  try { fd = openSync(filename, 'wx'); }
  catch (error) {
   if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
   let pid: number;
   try { pid = Number(readFileSync(filename, 'utf8').trim()); }
   catch { throw new Error('Outra inicialização está em andamento. Tente novamente em alguns segundos.'); }
   if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Trava do bot inválida. Confira os processos antes de remover .runtime/bot.lock.');
   try { process.kill(pid, 0); }
   catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
     try { unlinkSync(filename); } catch { /* Outra inicialização pode ter liberado. */ }
     continue;
    }
    throw e;
   }
   throw new Error(`O bot já está em execução (PID ${pid}). Use a instância existente ou encerre-a antes de executar npm start novamente.`);
  }
  try { writeFileSync(fd, String(process.pid)); } finally { closeSync(fd); }
  return () => {
   try { if (existsSync(filename) && readFileSync(filename, 'utf8').trim() === String(process.pid)) unlinkSync(filename); }
   catch { /* A trava obsoleta também é recuperada na próxima inicialização. */ }
  };
 }
 throw new Error('Outra inicialização está em andamento. Tente novamente.');
}
