// hooks/support/useOnlineUsers.js

import { useSelector } from 'react-redux';
import { selectOnlineUsersMap } from '../../store/slices/socketSlice';

/**
 * @param {string[]} [userIds]  if provided, returns only those; otherwise
 *   returns the full known presence map.
 */
export function useOnlineUsers(userIds) {
  const onlineUsersMap = useSelector(selectOnlineUsersMap);

  if (!userIds) {
    return { onlineUsersMap, isOnline: (userId) => !!onlineUsersMap[userId] };
  }

  const result = {};
  userIds.forEach((id) => {
    result[id] = !!onlineUsersMap[id];
  });
  return { onlineUsersMap: result, isOnline: (userId) => !!onlineUsersMap[userId] };
}

export default useOnlineUsers;
