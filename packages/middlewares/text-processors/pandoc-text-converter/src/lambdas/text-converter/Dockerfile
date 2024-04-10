FROM pandoc/latex:3.1.1-ubuntu

# Install Python.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    wget \
    python3 \
    python3-pip

# Install extra packages.
RUN tlmgr install scheme-basic &&\
    tlmgr install xcolor\ 
       booktabs\
       etoolbox \
       footnotehyper \
       lualatex-math \
       unicode-math \
       latexmk

# Copy application files in the container.
COPY . ./

# Install dependencies.
RUN pip3 install --upgrade pip && \
    pip3 install -r requirements.txt

# Using the Lambda Runtime Interface Client for Python
# as the entrypoint.
ENTRYPOINT ["/usr/bin/python3", "-m", "awslambdaric"]

# Set the function handler.
CMD ["index.lambda_handler"]
