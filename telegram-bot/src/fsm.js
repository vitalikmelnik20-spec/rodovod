// Простий FSM на основі Map — зберігає стан кожного користувача
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) sessions.set(userId, {});
  return sessions.get(userId);
}

function clearState(userId) {
  const s = getSession(userId);
  delete s.state;
  delete s.data;
}

function setState(userId, state, data = {}) {
  const s = getSession(userId);
  s.state = state;
  s.data = { ...s.data, ...data };
}

function getState(userId) {
  return getSession(userId).state || null;
}

function getData(userId) {
  return getSession(userId).data || {};
}

function setToken(userId, token) {
  getSession(userId).token = token;
}

function getToken(userId) {
  return getSession(userId).token || null;
}

function setCurrentTree(userId, treeId, treeName) {
  const s = getSession(userId);
  s.currentTreeId = treeId;
  s.currentTreeName = treeName;
}

function getCurrentTree(userId) {
  const s = getSession(userId);
  return { id: s.currentTreeId, name: s.currentTreeName };
}

module.exports = {
  getSession, clearState, setState, getState, getData,
  setToken, getToken, setCurrentTree, getCurrentTree,
};
