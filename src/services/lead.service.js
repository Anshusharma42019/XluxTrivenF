import API from '../api';

export const getLeads = (params) => API.get('/leads', { params }).then(r => r.data.data);
export const exportLeads = (params) => API.get('/leads/export', { params }).then(r => r.data.data);
export const getLead = (id) => API.get(`/leads/${id}`).then(r => r.data.data);
export const createLead = (data) => API.post('/leads', data).then(r => r.data.data);
export const updateLead = (id, data) => API.patch(`/leads/${id}`, data).then(r => r.data.data);
export const deleteLead = (id) => API.delete(`/leads/${id}`);
export const assignLead = (id, assignedTo) => API.patch(`/leads/${id}/assign`, { assignedTo }).then(r => r.data.data);
export const addLeadNote = (id, text) => API.post(`/leads/${id}/notes`, { text }).then(r => r.data.data);
export const deleteLeadNote = (id, noteId) => API.delete(`/leads/${id}/notes/${noteId}`).then(r => r.data.data);
export const markCNP = (id) => API.patch(`/leads/${id}/cnp`).then(r => r.data.data);
export const unmarkCNP = (id) => API.patch(`/leads/${id}/uncnp`).then(r => r.data.data);
export const searchByPhone = (phone) => API.get('/leads/search-phone', { params: { phone } }).then(r => r.data.data);
export const globalSearch = (q) => API.get('/search', { params: { q } }).then(r => r.data.data);
export const createCallAgain = (leadId, notes) => API.post('/call-again', { leadId, notes }).then(r => r.data.data);
export const getCallAgains = (params) => API.get('/call-again', { params }).then(r => r.data.data);
export const updateCallAgain = (id, data) => API.patch(`/call-again/${id}`, data).then(r => r.data.data);
export const distributeUnassigned = () => API.post('/leads/distribute-unassigned').then(r => r.data);
export const sendLeadWhatsApp = (leadId, message, templateName, languageCode, attachment) => {
  if (attachment) {
    const formData = new FormData();
    formData.append('leadId', leadId);
    formData.append('message', message || '');
    if (templateName) formData.append('templateName', templateName);
    if (languageCode) formData.append('languageCode', languageCode);
    formData.append('useStandardChat', 'true');
    formData.append('media', attachment);
    return API.post('/interakt/send-message', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data);
  }
  return API.post('/interakt/send-message', { 
    leadId, 
    message, 
    templateName, 
    languageCode, 
    useStandardChat: !templateName // Force standard chat if no template is provided
  }).then(r => r.data.data);
};
