import {
  ResourceDownloadPageController,
} from '@/features/download';
import { FavoritePlaceholderModal } from '@/features/library';

const ResourceDownloadPage = () => (
  <ResourceDownloadPageController FavoriteModal={FavoritePlaceholderModal} />
);

export default ResourceDownloadPage;
