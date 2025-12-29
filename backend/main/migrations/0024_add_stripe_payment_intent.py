from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0023_savefolder_savefolderitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="yardsalelisting",
            name="stripe_payment_intent",
            field=models.CharField(
                max_length=255,
                null=True,
                blank=True,
                help_text="Stripe PaymentIntent ID (optional)",
            ),
        ),
    ]
