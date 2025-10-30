import os
import uuid


def _ensure_boto():
    try:
        import boto3  # local import so tests don't require boto3 installed
        from botocore.exceptions import BotoCoreError, ClientError
        return boto3, BotoCoreError, ClientError
    except Exception as e:
        raise RuntimeError('boto3 is required for S3 uploads but is not installed') from e


def upload_fileobj_to_s3(file_obj, filename=None, content_type=None):
    """Upload a file-like object to S3 and return the public URL.

    Expects AWS credentials and bucket in environment variables.
    """
    bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    region = os.environ.get('AWS_REGION', '')
    access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    secret = os.environ.get('AWS_SECRET_ACCESS_KEY')

    if not bucket:
        raise RuntimeError('AWS_STORAGE_BUCKET_NAME not set in environment')

    boto3, BotoCoreError, ClientError = _ensure_boto()
    session = boto3.session.Session(aws_access_key_id=access_key, aws_secret_access_key=secret, region_name=region)
    s3 = session.client('s3')

    key = f"uploads/{uuid.uuid4().hex}_{filename or getattr(file_obj, 'name', 'file')}"

    extra_args = {'ACL': 'public-read'}
    if content_type:
        extra_args['ContentType'] = content_type

    try:
        s3.upload_fileobj(file_obj, bucket, key, ExtraArgs=extra_args)
    except (BotoCoreError, ClientError) as e:
        raise

    # Build URL
    custom = os.environ.get('AWS_S3_CUSTOM_DOMAIN')
    if custom:
        return f"https://{custom}/{key}"
    if region and region != 'us-east-1':
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"https://{bucket}.s3.amazonaws.com/{key}"
