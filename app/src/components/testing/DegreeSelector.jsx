import { useRecoilState } from 'recoil';
import { selectedDegreeState } from '../testing/devModeSelectedDegreeAtom';

const degrees = [
  { id: 'BIA', name: 'BIA' },
  { id: 'BBWL', name: 'BBWL' },
  { id: 'MBI', name: 'MBI' },

  // Add more degrees as needed
];

const DegreeSelector = () => {
  const [selectedDegree, setSelectedDegree] = useRecoilState(selectedDegreeState);

  return (
    <select 
      value={selectedDegree} 
      onChange={(e) => setSelectedDegree(e.target.value)}
      className="ml-4 p-1 border rounded"
    >
      <option value="">Select a degree</option>
      {degrees.map((degree) => (
        <option key={degree.id} value={degree.id}>
          {degree.name}
        </option>
      ))}
    </select>
  );
};

export default DegreeSelector;