import API from '../api';

export const getNotifications = (params) => API.get('/notifications', { params }).then(r => r.data.data);
export const markRead = (id) => API.patch(`/notifications/${id}/read`).then(r => r.data.data);
export const markAllRead = () => API.patch('/notifications/read-all');
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
export const deleteAllNotifications = () => API.delete('/notifications');
