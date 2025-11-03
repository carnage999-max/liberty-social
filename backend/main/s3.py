import uuid
from urllib.parse import quote
from decouple import config


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
    bucket = config('AWS_STORAGE_BUCKET_NAME', default=None)
    region = config('AWS_REGION', default=None) or config('AWS_S3_REGION', default='')
    access_key = config('AWS_ACCESS_KEY_ID', default=None)
    secret = config('AWS_SECRET_ACCESS_KEY', default=None)
    endpoint = config('AWS_S3_ENDPOINT_URL', default=None)

    if not bucket:
        raise RuntimeError('AWS_STORAGE_BUCKET_NAME not set in environment')
    if not access_key or not secret:
        raise RuntimeError('AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)')

    boto3, BotoCoreError, ClientError = _ensure_boto()
    session = boto3.session.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret,
        region_name=region or None,
    )
    client_kwargs = {}
    if endpoint:
        client_kwargs['endpoint_url'] = endpoint
    s3 = session.client('s3', **client_kwargs)

    key = f"uploads/{uuid.uuid4().hex}_{filename or getattr(file_obj, 'name', 'file')}"

    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type

    upload_kwargs = {}
    if extra_args:
        upload_kwargs['ExtraArgs'] = extra_args

    try:
        s3.upload_fileobj(file_obj, bucket, key, **upload_kwargs)
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f'Failed to upload file to S3: {e}') from e

    # Build URL
    custom = config('AWS_S3_CUSTOM_DOMAIN', default='').strip()
    encoded_key = quote(key, safe="/")
    if custom:
        if '{' in custom:
            try:
                custom = custom.format(bucket=bucket, region=region or 'us-east-1')
            except Exception:
                # fall back to raw string if formatting fails
                custom = custom.replace('{}', bucket)
        return f"https://{custom}/{encoded_key}"
    if region and region != 'us-east-1':
        return f"https://{bucket}.s3.{region}.amazonaws.com/{encoded_key}"
    return f"https://{bucket}.s3.amazonaws.com/{encoded_key}"
