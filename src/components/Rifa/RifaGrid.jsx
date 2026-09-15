import React from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';
import { NUMBERS_PER_PAGE } from '../../config';

const RifaGrid = ({
  soldNumbers = [],
  pendingNumbers = [],
  mySoldNumbers = [],
  currentNumber,
  selectedNumbers = [],
  onNumberClick,
  pageIndex = 0,
  isAdmin = false,
  totalNumbers = 100,
  numbersPerPage = NUMBERS_PER_PAGE,
  getBoletoProps, // Opcional para sobreescritura manual si se requiere
}) => {
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const numCols = isMobile ? 5 : 10;

  const startNumber = pageIndex * numbersPerPage;
  const endNumber = Math.min(startNumber + numbersPerPage, totalNumbers);

  const numbersToRender = [];
  for (let i = startNumber + 1; i <= endNumber; i++) {
    numbersToRender.push(i);
  }

  return (
    <div
      className="grid gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
    >
      {numbersToRender.map((number) => {
        // Soporte si se pasa función personalizada de props
        if (getBoletoProps) {
          const { className, disabled, title } = getBoletoProps(number);
          return (
            <button
              key={number}
              type="button"
              onClick={() => !disabled && onNumberClick && onNumberClick(number)}
              disabled={disabled}
              className={className}
              title={title}
            >
              {number}
            </button>
          );
        }

        // Lógica de presentación estándar del componente
        const isSold = soldNumbers.includes(number);
        const isPending = pendingNumbers.includes(number);
        const isSelected = selectedNumbers.includes(number) || currentNumber === number;
        const isMine = mySoldNumbers.includes(number);

        // Estado: Disponible por defecto (blanco / gris suave con hover)
        let colorClasses =
          'bg-gray-50 dark:bg-gray-700/60 hover:bg-primary/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600 cursor-pointer';
        let title = `Boleto #${number} - Disponible`;

        // Estado: Vendido (Rojo descriptivo)
        if (isSold) {
          colorClasses =
            'bg-red-500 text-white font-bold border-red-600 shadow-sm hover:bg-red-600';
          if (isMine) {
            colorClasses += ' ring-2 ring-emerald-400 ring-offset-1';
            title = `Boleto #${number} - Vendido por mí`;
          } else {
            title = `Boleto #${number} - Vendido`;
          }
        }
        // Estado: Pendiente / Reservado (Amarillo / Ámbar)
        else if (isPending) {
          colorClasses =
            'bg-amber-400 text-gray-900 font-bold border-amber-500 hover:bg-amber-500 shadow-sm';
          title = `Boleto #${number} - Reserva Pendiente`;
        }

        // Estado: Seleccionado (Borde destacado y fondo suave)
        if (isSelected) {
          colorClasses =
            'bg-primary/20 text-primary font-bold border-primary border-dashed shadow-sm scale-105 ring-2 ring-primary/40';
          title = `Boleto #${number} - Seleccionado`;
        }

        // Si no es admin y está vendido por otro vendedor, bloquear clic (salvo que ya esté en la selección)
        const isBlocked = !isAdmin && isSold && !isMine && !isSelected;

        return (
          <button
            key={number}
            type="button"
            onClick={() => (!isBlocked || isAdmin) && onNumberClick && onNumberClick(number)}
            disabled={isBlocked && !isAdmin}
            className={`aspect-square rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold border-2 flex items-center justify-center transition-all active:scale-95 ${colorClasses} ${
              isBlocked && !isAdmin ? 'cursor-not-allowed opacity-90' : ''
            }`}
            title={title}
          >
            {number}
          </button>
        );
      })}
    </div>
  );
};

export default RifaGrid;