import API from '../api';

export const getUsers = (params) => API.get('/users', { params }).then(r => r.data.data);
export const createUser = (data) => API.post('/users', data).then(r => r.data.data);
export const updateUser = (id, data) => API.patch(`/users/${id}`, data).then(r => r.data.data);
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const getStaffShipmentCounts = () => API.get('/users/stats/shipment-counts').then(r => r.data.data);
