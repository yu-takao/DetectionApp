FROM public.ecr.aws/lambda/python:3.12

# システム依存（libsndfile + ビルドツール）
RUN dnf install -y libsndfile gcc gcc-c++ cmake make && dnf clean all

# Python依存パッケージ
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# ハンドラーコード
COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
