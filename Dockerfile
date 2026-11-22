# Dockerfile for Deploying PregnaCare Backend to Render / Cloud
FROM php:8.2-apache

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache rewrite and headers modules
RUN a2enmod rewrite headers

# Allow .htaccess overrides and set DocumentRoot
RUN sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Copy application files
COPY . /var/www/html/

# Permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

EXPOSE 80 10000

# Bind Apache to $PORT dynamically at container startup (supports Render, Railway, etc.)
CMD sh -c "sed -i 's/80/'\${PORT:-80}'/g' /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf && exec apache2-foreground"
