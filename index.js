import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import pino from 'pino'
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (t) => new Promise(r => rl.question(t, r))

let notas = {}
let niveles = {}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion-gru-pito')
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false
  })

  if (!sock.authState.creds.registered) {
    const num = await question('📱 Numero con codigo pais ej 51999999999: ')
    const code = await sock.requestPairingCode(num.trim())
    console.log(`\n🔥 CODIGO GRU-PITO: ${code}\nVe a WhatsApp > Dispositivos vinculados > Vincular con numero\n`)
  }

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') console.log('✅ BOT GRU-PITO 24/7 CONECTADO')
    if (u.connection === 'close') {
      if (u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const id = m.key.remoteJid
    const txt = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim()
    const text = txt.toLowerCase()

    if (text === '.menu') {
      await sock.sendMessage(id, { text: `🤖 *BOT GRU-PITO 24/7*\n\n📝 *.nota texto* - Guarda nota\n📖 *.vernotas* - Ver notas\n📊 *.nivel* - Ver XP\n🏆 *.niveles* - Ranking\n\n_Activo 24/7 aunque no estes_` })
    }
    if (text.startsWith('.nota ')) {
      const n = txt.slice(6)
      if (!notas[id]) notas[id] = []
      notas[id].push(n)
      await sock.sendMessage(id, { text: `✅ Nota guardada: ${n}` })
    }
    if (text === '.vernotas') {
      const l = notas[id] || []
      await sock.sendMessage(id, { text: l.length? l.map((x,i)=>`${i+1}. ${x}`).join('\n') : 'Sin notas' })
    }
    if (text === '.nivel') {
      niveles[id] = (niveles[id]||0)+15
      await sock.sendMessage(id, { text: `📊 XP: ${niveles[id]} Nivel: ${Math.floor(niveles[id]/100)}` })
    }
    if (text === '.niveles') {
      let rank = Object.entries(niveles).sort((a,b)=>b[1]-a[1]).slice(0,5).map((e,i)=>`${i+1}. ${e[0].split('@')[0]} - ${e[1]} XP`).join('\n')
      await sock.sendMessage(id, { text: `🏆 *TOP NIVELES*\n${rank || 'Aun nadie'}` })
    }
  })
}
startBot()
