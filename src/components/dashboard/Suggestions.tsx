import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight } from 'lucide-react';

export function Suggestions() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 px-1">Sugerencias</h2>

      <div className="flex flex-col gap-3">
        <motion.div
          whileTap={{
            scale: 0.98
          }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb size={20} className="text-yellow-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">Mejora tu agarre</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-3">
              Notamos una ligera disminución en la fuerza de pinza. Prueba el
              ejercicio &quot;Pinza con Esponja&quot;.
            </p>
            <button className="text-blue-600 text-sm font-semibold flex items-center gap-1">
              Ver ejercicio <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>

        <motion.div
          whileTap={{
            scale: 0.98
          }}
          className="bg-white p-4 rounded-2xl shadow-sm border-gray-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <div className="text-purple-600 font-bold text-lg">?</div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">
              ¿Dolor al ejercitar?
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Recuerda que el dolor agudo no es normal. Consulta nuestra guía de
              síntomas.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}