import API from '../api';

export const getAppointments = async (params) => {
  const { data } = await API.get('/appointments', { params });
  return data.data;
};

export const createAppointment = async (body) => {
  const { data } = await API.post('/appointments', body);
  return data.data;
};

export const updateAppointment = async (id, body) => {
  const { data } = await API.patch(`/appointments/${id}`, body);
  return data.data;
};

export const deleteAppointment = async (id) => {
  await API.delete(`/appointments/${id}`);
};

export const getAvailability = async (date, timeSlot) => {
  const { data } = await API.get('/appointments/availability', { params: { date, timeSlot } });
  return data.data;
};

export const getBookedSlots = async (date, doctorName) => {
  const { data } = await API.get('/appointments/booked-slots', { params: { date, doctorName } });
  return data.data;
};

export const addFieldNote = async (id, text) => {
  const { data } = await API.post(`/appointments/${id}/field-notes`, { text });
  return data.data;
};

export const searchByPhone = async (phone) => {
  const clean = phone.replace(/\D/g, '');
  let result = null;

  // 1. Search leads
  try {
    const { data } = await API.get('/leads/search-phone', { params: { phone: clean } });
    const leads = data?.data || [];
    if (leads.length) {
      const l = leads[0];
      result = {
        patientName: l.name || '',
        email: l.email || '',
        address: l.address || '',
        houseNo: l.houseNo || '',
        cityVillage: l.cityVillage || '',
        postOffice: l.postOffice || '',
        landmark: l.landmark || '',
        district: l.district || '',
        state: l.state || '',
        pincode: l.pincode || '',
        problem: l.problem || '',
        patientType: 'old',
      };
    }
  } catch (e) { console.warn('lead search failed', e?.message); }

  // 2. Search previous appointments (merge missing fields)
  if (!result || !result.cityVillage) {
    try {
      const { data } = await API.get('/appointments', { params: { search: clean, limit: 5 } });
      const appts = data?.data?.appointments || [];
      if (appts.length) {
        const a = appts[0];
        result = {
          patientName: result?.patientName || a.patientName || '',
          email: result?.email || a.email || '',
          address: result?.address || a.address || '',
          houseNo: result?.houseNo || a.houseNo || '',
          cityVillage: result?.cityVillage || a.cityVillage || '',
          postOffice: result?.postOffice || a.postOffice || '',
          landmark: result?.landmark || a.landmark || '',
          district: result?.district || a.district || '',
          state: result?.state || a.state || '',
          pincode: result?.pincode || a.pincode || '',
          problem: result?.problem || a.problem || '',
          medicineDeliveryDate: a.medicineDeliveryDate ? new Date(a.medicineDeliveryDate).toISOString().split('T')[0] : '',
          patientType: 'old',
        };
      }
    } catch (e) { console.warn('appointment search failed', e?.message); }
  }

  // 3. Search Shiprocket orders (always run to get medicineDeliveryDate + fill missing address)
  try {
    const { data } = await API.get('/shiprocket/orders/search-by-phone', { params: { phone: clean } });
    if (data?.data) {
      const o = data.data;
      const deliveryDate = o.deliveredAt ? new Date(o.deliveredAt).toISOString().split('T')[0] : '';
      result = {
        patientName: result?.patientName || o.patientName || '',
        email: result?.email || o.email || '',
        address: result?.address || o.address || '',
        houseNo: result?.houseNo || o.houseNo || '',
        cityVillage: result?.cityVillage || o.city || '',
        postOffice: result?.postOffice || o.postOffice || '',
        landmark: result?.landmark || o.landmark || '',
        district: result?.district || o.district || '',
        state: result?.state || o.state || '',
        pincode: result?.pincode || String(o.pincode || ''),
        problem: result?.problem || '',
        medicineDeliveryDate: result?.medicineDeliveryDate || deliveryDate,
        patientType: 'old',
      };
    }
  } catch (e) { console.warn('shiprocket search failed', e?.message); }

  return result;
};
