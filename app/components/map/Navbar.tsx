'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBars, 
  faFilter, 
  faSquareCheck, 
  faMagnifyingGlass 
} from '@fortawesome/free-solid-svg-icons';

const Navbar = () => {
  return (
    <div className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-white px-4 py-2 flex items-center justify-between h-12 shadow-md">
      <div className="flex items-center gap-4">
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold tracking-wide">Map My Field</h1>
      </div>
      <div className="flex items-center gap-4">
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faFilter} className="h-5 w-5" />
        </button>
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faSquareCheck} className="h-5 w-5" />
        </button>
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Navbar; 