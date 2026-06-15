const axios = require('axios');

const BASE = process.env.API_URL || 'http://localhost:3000/api';

async function request(method, path, data, token) {
  try {
    const res = await axios({
      method, url: `${BASE}${path}`, data,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return res.data;
  } catch (err) {
    throw err.response?.data || { error: 'API error' };
  }
}

module.exports = {
  auth: (tgUser) => request('POST', '/auth/telegram/bot', tgUser),
  generateLoginCode: (telegram_id) => request('POST', '/auth/generate-code', {
    telegram_id,
    bot_secret: process.env.BOT_SECRET,
  }),
  getTrees: (token) => request('GET', '/trees', null, token),
  createTree: (name, token) => request('POST', '/trees', { name }, token),
  getTree: (id, token) => request('GET', `/trees/${id}`, null, token),
  getMembers: (treeId, token) => request('GET', `/trees/${treeId}/members`, null, token),
  invite: (treeId, token) => request('POST', `/trees/${treeId}/invite`, {}, token),

  getPersons: (treeId, token) => request('GET', `/trees/${treeId}/persons`, null, token),
  searchPersons: (treeId, q, token) => request('GET', `/trees/${treeId}/persons/search?q=${encodeURIComponent(q)}`, null, token),
  getPerson: (treeId, pid, token) => request('GET', `/trees/${treeId}/persons/${pid}`, null, token),
  createPerson: (treeId, data, token) => request('POST', `/trees/${treeId}/persons`, data, token),
  updatePerson: (treeId, pid, data, token) => request('PUT', `/trees/${treeId}/persons/${pid}`, data, token),
  deletePerson: (treeId, pid, token) => request('DELETE', `/trees/${treeId}/persons/${pid}`, null, token),

  getRelationships: (treeId, token) => request('GET', `/trees/${treeId}/relationships`, null, token),
  createRelationship: (treeId, data, token) => request('POST', `/trees/${treeId}/relationships`, data, token),

  getHistory: (treeId, token) => request('GET', `/trees/${treeId}/history`, null, token),

  getProposals: (treeId, token) => request('GET', `/trees/${treeId}/proposals`, null, token),
  approveProposal: (propId, token) => request('PUT', `/proposals/${propId}/approve`, {}, token),
  rejectProposal: (propId, note, token) => request('PUT', `/proposals/${propId}/reject`, { note }, token),
};
