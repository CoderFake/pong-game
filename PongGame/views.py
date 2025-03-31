from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.conf import settings


class LanguageOptionsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """Trả về danh sách ngôn ngữ được hỗ trợ"""
        return Response({
            'languages': settings.LANGUAGES,
            'current': request.LANGUAGE_CODE
        })