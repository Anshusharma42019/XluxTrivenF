import API from '../api';

export const getTasks = (params) => API.get('/tasks', { params }).then(r => r.data.data);
export const getTask = (id) => API.get(`/tasks/${id}`).then(r => r.data.data);
export const getTaskByLead = (leadId) => API.get(`/tasks/by-lead/${leadId}`).then(r => r.data.data);
export const getDailyTasks = (params) => API.get('/tasks/daily', { params }).then(r => r.data.data);
export const createTask = (data) => API.post('/tasks', data).then(r => r.data.data);
export const updateTask = (id, data) => API.patch(`/tasks/${id}`, data).then(r => r.data.data);
export const deleteTask = (id) => API.delete(`/tasks/${id}`);
export const addTaskNote = (id, text) => API.post(`/tasks/${id}/notes`, { text }).then(r => r.data.data);
export const getCnpRecords = (params) => API.get('/cnp', { params }).then(r => r.data.data);
export const incrementCnpCount = (id) => API.patch(`/cnp/${id}/increment`).then(r => r.data.data);
export const deleteCnpRecord = (id) => API.delete(`/cnp/${id}`);
export const getVerificationRecords = (params) => API.get('/verification', { params }).then(r => r.data.data);
export const getOnHoldVerificationRecords = (params) => API.get('/verification/on-hold', { params }).then(r => r.data.data);
export const syncVerificationRecords = () => API.post('/verification/sync').then(r => r.data);
export const updateVerificationStatus = (id, status, onHoldUntil, onHoldReason) => API.patch(`/verification/${id}`, { status, ...(onHoldUntil && { onHoldUntil }), ...(onHoldReason && { onHoldReason }) }).then(r => r.data.data);
export const updateVerificationRecord = (id, data) => API.patch(`/verification/${id}`, data).then(r => r.data.data);
export const deleteVerificationRecord = (id) => API.delete(`/verification/${id}`);
