from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema
from .s3 import upload_fileobj_to_s3


class UploadImageView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        # accept a single file with key 'file' or multiple under 'files'
        files = list(request.FILES.getlist('files'))
        if not files:
            single = request.FILES.get('file')
            if single:
                files = [single]
        if not files:
            return Response({'detail': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        uploaded = []
        try:
            for f in files:
                url = upload_fileobj_to_s3(f, filename=f.name, content_type=f.content_type)
                uploaded.append(
                    {
                        'url': url,
                        'content_type': getattr(f, 'content_type', None),
                        'name': f.name,
                        'size': getattr(f, 'size', None),
                    }
                )
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        payload = {
            'url': uploaded[0]['url'],
            'urls': [item['url'] for item in uploaded],
            'items': uploaded,
        }
        return Response(payload)
