import React from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';
import { NUMBERS_PER_PAGE, TOTAL_NUMBERS } from '../../config';

const RifaGrid = ({ soldNumbers, pendingNumbers = [], currentNumber, onNumberClick, pageIndex, isAdmin = false }) => {
    const { width } = useWindowSize();
    const isMobile = width < 768;
    const numCols = isMobile ? 5 : 10;
    
    const startNumber = pageIndex * NUMBERS_PER_PAGE;
    const endNumber = Math.min(startNumber + NUMBERS_PER_PAGE, TOTAL_NUMBERS);
    
    const numbersToRender = [];
    for (let i = startNumber + 1; i <= endNumber; i++) {
        numbersToRender.push(i);
    }

    return (
        <div 
            className="grid gap-2" 
            style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
        >
            {numbersToRender.map((number) => {
                const isSold = soldNumbers.includes(number);
                const isPending = pendingNumbers.includes(number);
                const isSelected = currentNumber === number;

                // Bloqueamos click si está vendido O pendiente (solo si no es admin)
                const isBlocked = !isAdmin && (isSold || isPending);

                return (
                    <div
                        key={number}
                        onClick={() => (!isBlocked || isAdmin) && onNumberClick(number)}
                        className={`number-grid-item 
                            ${isSold ? 'sold' : ''} 
                            ${isPending ? 'pending' : ''} 
                            ${isSelected ? 'selected' : ''}`}
                        title={isPending ? "Reservado (Pendiente)" : isSold ? "Vendido" : "Disponible"}
                    >
                        {number}
                    </div>
                );
            })}
        </div>
    );
};

export default RifaGrid;