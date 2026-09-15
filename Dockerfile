FROM php:8.1-cli

# Install MySQL PDO extension
RUN docker-php-ext-install pdo pdo_mysql

# Set working directory
WORKDIR /app

# Copy all files from repo
COPY . .

# Expose port 8080
EXPOSE 8080

# Start PHP development server with router
CMD ["php", "-S", "0.0.0.0:8080", "router.php"]
