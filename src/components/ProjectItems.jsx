'use client';

import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import EditItemDialog from '@/components/EditItemDialog';
import List from '@/components/List';
import LoadingSpinner from '@/components/LoadingSpinner';
import useStore from '@/store';

const ProjectItems = ({ projectId }) => {
  const { user } = useAuth();
  const { items, isLoadingItems: isLoading, fetchItems } = useStore();
  const currentUserId = user?.id;

  if (!projectId) {
    return null;
  }

  useEffect(() => {
    fetchItems({ userId: currentUserId, projectId });
  }, [currentUserId, fetchItems, projectId]);

  if (isLoading && !items.length) {
    return <LoadingSpinner />;
  }

  return (
    <List
      data={items}
      className="flex flex-col gap-4"
      renderItem={(item) => (
        <div className="flex items-center gap-4">
          <span className="text-gray-700 font-semibold">{item.quantity}</span>
          <span className="text-gray-700 flex-grow">{item.name}</span>
          <EditItemDialog itemId={item.id} projectId={projectId} />
        </div>
      )}
    />
  );
};

ProjectItems.propTypes = {
  projectId: PropTypes.number,
};

export default ProjectItems;
