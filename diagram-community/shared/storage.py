from minio import Minio
from minio.error import S3Error
import os
from typing import BinaryIO, Optional
import logging

logger = logging.getLogger(__name__)


class MinioStorage:
    def __init__(self):
        self.endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        self.access_key = os.getenv("MINIO_ACCESS_KEY", "cloudmigrate")
        self.secret_key = os.getenv("MINIO_SECRET_KEY", "cloudmigrate2025")
        self.bucket = os.getenv("MINIO_BUCKET", "architecture-diagrams")
        
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=False
        )
        
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created bucket: {self.bucket}")
        except S3Error as e:
            logger.error(f"Error ensuring bucket exists: {e}")
            raise
    
    def upload_file(self, object_name: str, file_data: BinaryIO, length: int, content_type: str = "application/octet-stream") -> str:
        try:
            self.client.put_object(
                self.bucket,
                object_name,
                file_data,
                length,
                content_type=content_type
            )
            url = f"http://{self.endpoint}/{self.bucket}/{object_name}"
            logger.info(f"Uploaded file: {object_name}")
            return url
        except S3Error as e:
            logger.error(f"Error uploading file: {e}")
            raise
    
    def download_file(self, object_name: str) -> bytes:
        try:
            response = self.client.get_object(self.bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Error downloading file: {e}")
            raise
    
    def get_file_url(self, object_name: str) -> str:
        return f"http://{self.endpoint}/{self.bucket}/{object_name}"
    
    def delete_file(self, object_name: str) -> bool:
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Deleted file: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"Error deleting file: {e}")
            return False
    
    def file_exists(self, object_name: str) -> bool:
        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error:
            return False
