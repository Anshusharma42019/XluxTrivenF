const colors = {
  new:          'bg-blue-100 text-blue-700',
  old:          'bg-slate-100 text-slate-600',
  contacted:    'bg-yellow-100 text-yellow-700',
  interested:   'bg-purple-100 text-purple-700',
  follow_up:    'bg-orange-100 text-orange-700',
  closed_won:   'bg-green-100 text-green-700',
  closed_lost:  'bg-red-100 text-red-700',
  pending:      'bg-yellow-100 text-yellow-700',
  completed:    'bg-green-100 text-green-700',
  overdue:      'bg-red-100 text-red-700',
  cancelled:    'bg-gray-100 text-gray-500',
  admin:        'bg-purple-100 text-purple-700',
  manager:      'bg-blue-100 text-blue-700',
  sales:        'bg-green-100 text-green-700',
  high:         'bg-red-100 text-red-700',
  medium:       'bg-yellow-100 text-yellow-700',
  low:          'bg-gray-100 text-gray-600',
};

export default function Badge({ value }) {
  const label = value?.replace(/_/g, ' ');
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}
