const crypto = require('crypto');

function verifyTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const user = JSON.parse(params.get('user') || 'null');
  return user;
}

function verifyTelegramLoginWidget(data) {
  const { hash, ...fields } = data;
  if (!hash) return null;

  const dataCheckString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const authDate = parseInt(fields.auth_date, 10);
  if (Date.now() / 1000 - authDate > 86400) return null;

  return {
    id: fields.id,
    first_name: fields.first_name,
    last_name: fields.last_name,
    username: fields.username,
    photo_url: fields.photo_url,
  };
}

module.exports = { verifyTelegramInitData, verifyTelegramLoginWidget };
