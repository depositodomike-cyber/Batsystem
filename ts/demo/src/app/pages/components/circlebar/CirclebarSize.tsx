import { Circlebar } from "@/components/ui";

// ----------------------------------------------------------------------

const CirclebarSize = () => {
  return (
    <div className="inline-space flex max-w-2xl flex-wrap items-center">
      <Circlebar value={75} size={14} strokeWidth={2} color="primary">
        <span className="text-xs font-medium text-gray-800 dark:text-dark-100">
          75%
        </span>
      </Circlebar>
      <Circlebar value={75} size={20} strokeWidth={3} color="primary">
        <span className="text-sm font-medium text-gray-800 dark:text-dark-100">
          75%
        </span>
      </Circlebar>
      <Circlebar value={75} size={24} strokeWidth={4} color="primary">
        <span className="text-lg font-medium text-gray-800 dark:text-dark-100">
          75%
        </span>
      </Circlebar>
      <Circlebar value={75} size={28} strokeWidth={5} color="primary">
        <span className="text-xl font-medium text-gray-800 dark:text-dark-100">
          75%
        </span>
      </Circlebar>
      <Circlebar value={75} size={32} strokeWidth={6} color="primary">
        <span className="text-2xl font-medium text-gray-800 dark:text-dark-100">
          75%
        </span>
      </Circlebar>
    </div>
  );
};

export { CirclebarSize }; 